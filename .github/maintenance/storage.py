#!/usr/bin/env python3
"""Inventory or remove an audited list of redundant keyboard build archives.
Never downloads artifact contents, touches Releases, runs, Git history or keys.
"""
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

REPOSITORY = 'helbermoura2/teclado-br'
ALLOWED = {
    'teclado-br-heli-compilado', 'teclado-br-heli-apk-e-fontes',
    'teclado-br-heli-apk', 'teclado-br-heli-fontes',
    'teclado-br-heli-unitarios', 'teclado-br-heli-testes',
}
ROLLBACK = {13143308299, 13144012909, 13144117861, 13144544046}


def protected(name):
    return bool(re.search(r'chave|keystore|sign|assin|cert', name, re.I))


def validate_plan(plan, artifacts):
    if plan.get('version') != 1 or plan.get('repository') != REPOSITORY:
        raise ValueError('Unexpected maintenance plan/repository')
    if plan.get('mode') not in ('inventory', 'apply'):
        raise ValueError('Unknown mode')
    keep = ROLLBACK | set(plan.get('preserve_artifact_ids', []))
    current = {a['id']: a for a in artifacts}
    targets, absent, seen = [], [], set()
    for entry in plan.get('delete_artifacts', []):
        ident, name = entry['id'], entry['name']
        if type(ident) is not int or ident <= 0 or ident in seen:
            raise ValueError('Invalid/repeated artifact ID')
        seen.add(ident)
        if ident in keep or protected(name) or name not in ALLOWED:
            raise ValueError('Plan includes a protected/unknown artifact')
        actual = current.get(ident)
        if actual is None:
            absent.append(ident)
            continue
        if (actual['name'] != name or actual['size_in_bytes'] != entry['bytes']
                or (actual.get('workflow_run') or {}).get('id') != entry['run_id']):
            raise ValueError('Artifact metadata does not match audited plan')
        targets.append(actual)
    return targets, absent


def main():
    if os.environ.get('GITHUB_REPOSITORY') != REPOSITORY:
        raise SystemExit('This maintenance workflow is restricted to its repository')
    token = os.environ['GH_TOKEN']

    def api(path, method='GET'):
        request = urllib.request.Request(
            'https://api.github.com/repos/' + REPOSITORY + path,
            headers={'Authorization': 'Bearer ' + token,
                     'Accept': 'application/vnd.github+json',
                     'X-GitHub-Api-Version': '2022-11-28',
                     'User-Agent': 'TecladoBR-storage-maintenance'}, method=method)
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read()
            return json.loads(data) if data else None

    def pages(path, key):
        result = []
        for page in range(1, 101):
            data = api(f'{path}?per_page=100&page={page}')[key]
            result.extend(data)
            if len(data) < 100:
                return result
        raise RuntimeError('Inventory pagination limit reached')

    if not api('')['private']:
        raise SystemExit('Expected private repository; no changes made')
    artifacts = pages('/actions/artifacts', 'artifacts')
    caches = pages('/actions/caches', 'actions_caches')
    print('STORAGE_SUMMARY ' + json.dumps({
        'artifact_count': len(artifacts),
        'artifact_bytes': sum(a['size_in_bytes'] for a in artifacts),
        'cache_count': len(caches),
        'cache_bytes': sum(a['size_in_bytes'] for a in caches),
    }), flush=True)
    for a in artifacts:
        print('STORAGE_ARTIFACT ' + json.dumps({
            'id': a['id'], 'name': a['name'], 'bytes': a['size_in_bytes'],
            'run_id': (a.get('workflow_run') or {}).get('id'),
            'expired': a['expired'], 'created': a['created_at'],
        }), flush=True)
    for a in caches:
        print('STORAGE_CACHE ' + json.dumps({
            'id': a['id'], 'key': a['key'], 'bytes': a['size_in_bytes'],
            'last_accessed': a['last_accessed_at'], 'ref': a['ref'],
        }), flush=True)
    plan = json.loads(Path('.github/maintenance/storage-plan.json').read_text())
    targets, absent = validate_plan(plan, artifacts)
    print('STORAGE_PLAN ' + json.dumps({
        'mode': plan['mode'], 'delete_count': len(targets),
        'delete_bytes': sum(a['size_in_bytes'] for a in targets),
        'already_absent': absent,
    }), flush=True)
    if plan['mode'] != 'apply':
        return
    # Validate the whole plan before the first deletion, then delete only those IDs.
    removed = []
    for a in targets:
        try:
            api('/actions/artifacts/' + str(a['id']), method='DELETE')
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
        removed.append(a['id'])
        print('STORAGE_DELETED ' + str(a['id']), flush=True)
        time.sleep(0.85)  # Stay below mutation rate limits.
    remaining = pages('/actions/artifacts', 'artifacts')
    ids = {a['id'] for a in remaining}
    if ids.intersection(removed):
        raise RuntimeError('Some planned artifacts still exist')
    # Every artifact outside the approved deletion list must remain untouched.
    expected_keep = {a['id'] for a in artifacts} - set(removed)
    if not expected_keep.issubset(ids):
        raise RuntimeError('An unplanned artifact disappeared; inspect concurrent activity')
    summary = {
        'removed_count': len(removed),
        'removed_bytes': sum(a['size_in_bytes'] for a in targets),
        'remaining_count': len(remaining),
        'remaining_bytes': sum(a['size_in_bytes'] for a in remaining),
        'all_unplanned_artifacts_preserved': True,
        'releases_keys_runs_history_caches_untouched': True,
    }
    print('STORAGE_RESULT ' + json.dumps(summary), flush=True)
    Path(os.environ['GITHUB_STEP_SUMMARY']).write_text(
        '# Storage cleanup\n\n```json\n' + json.dumps(summary, indent=2) + '\n```\n')


if __name__ == '__main__':
    main()
