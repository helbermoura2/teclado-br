#!/usr/bin/env python3
"""Apply the fixed, user-approved CENA artifact inventory; never delete releases."""
import hashlib
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

REPOSITORY = 'helbermoura2/teclado-br'
KEEP_RUNS = {41831411443, 41831411052, 41831411472,
             41656220781, 41656220601, 41656220757}
EXPECTED_COUNT = 108
EXPECTED_BYTES = 4691816324


def allowed(name):
    return (name in {'CENA-local-visual-model-report', 'CENA-SISU-browser-QA', 'CENA-Android-APK'}
            or re.fullmatch(r'CENA-Android-\d+\.\d+\.\d+', name) is not None)


def matches(entry, actual):
    return (entry['name'] == actual['name']
            and entry['bytes'] == actual['size_in_bytes']
            and entry['run_id'] == (actual.get('workflow_run') or {}).get('id'))


def validate(plan, artifacts):
    if (plan.get('version') != 1 or plan.get('mode') != 'apply'
            or plan.get('repository') != REPOSITORY):
        raise ValueError('Wrong plan/repository/mode')
    entries = plan['delete_artifacts']
    if (len(entries) != EXPECTED_COUNT
            or sum(e['bytes'] for e in entries) != EXPECTED_BYTES):
        raise ValueError('The plan differs from the approved 108 artifacts')
    current = {a['id']: a for a in artifacts}
    keep = plan['preserve_artifacts']
    if len(keep) != 6 or {e['run_id'] for e in keep} != KEEP_RUNS:
        raise ValueError('Missing approved current/rollback artifacts')
    for entry in keep:
        if entry['id'] not in current or not matches(entry, current[entry['id']]):
            raise ValueError('An artifact required for preservation is missing/changed')
    keep_ids = {e['id'] for e in keep}
    seen, targets, absent = set(), [], []
    for entry in entries:
        ident = entry['id']
        if (type(ident) is not int or ident <= 0 or ident in seen
                or ident in keep_ids or entry['run_id'] in KEEP_RUNS
                or not allowed(entry['name'])
                or re.search(r'keystore|sign|assin|cert|chave', entry['name'], re.I)):
            raise ValueError('Protected, unknown or duplicate artifact in the plan')
        seen.add(ident)
        actual = current.get(ident)
        if actual is None:
            absent.append(ident)
        elif not matches(entry, actual):
            raise ValueError('Artifact identity differs from audited metadata')
        elif (actual.get('workflow_run') or {}).get('head_branch') != 'cena/android-preview':
            raise ValueError('Artifact does not belong to the approved CENA branch')
        else:
            targets.append(actual)
    return targets, absent


def release_snapshot(releases):
    return {a['id']: (r['id'], r['tag_name'], a['name'], a['size'], a.get('digest'))
            for r in releases for a in r.get('assets', [])}


def main():
    if (os.environ.get('GITHUB_REPOSITORY') != REPOSITORY
            or os.environ.get('GITHUB_REF') != 'refs/heads/cena/android-preview'):
        raise SystemExit('Unexpected repository or branch')
    base = Path(__file__).resolve().parent
    raw = (base / 'plan.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != os.environ['APPROVED_PLAN_SHA256']:
        raise SystemExit('The approved plan hash does not match')
    plan = json.loads(raw)
    token = os.environ['GH_TOKEN']

    def get(path):
        request = urllib.request.Request(
            'https://api.github.com/repos/' + REPOSITORY + path,
            headers={'Authorization': 'Bearer ' + token,
                     'Accept': 'application/vnd.github+json',
                     'X-GitHub-Api-Version': '2022-11-28',
                     'User-Agent': 'CENA-approved-artifact-cleanup'})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)

    def pages(path, key=None):
        rows = []
        for page in range(1, 101):
            value = get(f'{path}?per_page=100&page={page}')
            part = value[key] if key else value
            rows.extend(part)
            if len(part) < 100:
                return rows
        raise RuntimeError('Pagination limit reached')

    if not get('')['private']:
        raise SystemExit('Expected a private repository')
    before = pages('/actions/artifacts', 'artifacts')
    releases = pages('/releases')
    protected_releases = release_snapshot(releases)
    by_tag = {r['tag_name']: r for r in releases}
    for version in ('0.15.0', '0.14.0'):
        release = by_tag.get('cena-v' + version)
        if not release or not any(a['name'] == f'CENA-{version}.apk'
                                  for a in release['assets']):
            raise SystemExit('A release APK required for preservation is missing')
    signing = by_tag.get('cena-internal-signing')
    if (not signing or not signing['draft']
            or not any(a['name'] == 'cena-preview.keystore' for a in signing['assets'])):
        raise SystemExit('The private signing identity must be preserved')
    targets, absent = validate(plan, before)
    print('CENA_CLEANUP_PLAN ' + json.dumps({
        'approved_count': EXPECTED_COUNT, 'approved_bytes': EXPECTED_BYTES,
        'present_count': len(targets), 'already_absent': absent,
        'present_bytes': sum(a['size_in_bytes'] for a in targets),
        'preserved_artifact_ids': [a['id'] for a in plan['preserve_artifacts']],
    }), flush=True)
    removed = []
    for artifact in targets:
        # This is the only mutation: an exact artifact ID from the validated plan.
        ident = artifact['id']
        request = urllib.request.Request(
            f'https://api.github.com/repos/{REPOSITORY}/actions/artifacts/{ident}',
            headers={'Authorization': 'Bearer ' + token,
                     'Accept': 'application/vnd.github+json',
                     'X-GitHub-Api-Version': '2022-11-28'}, method='DELETE')
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                if response.status != 204:
                    raise RuntimeError('Artifact deletion was not confirmed')
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise
        removed.append(ident)
        print('CENA_CLEANUP_DELETED ' + str(ident), flush=True)
        time.sleep(0.85)
    after = pages('/actions/artifacts', 'artifacts')
    after_ids = {a['id'] for a in after}
    approved_ids = {a['id'] for a in plan['delete_artifacts']}
    if after_ids.intersection(approved_ids):
        raise RuntimeError('A planned artifact remains')
    unplanned = {a['id'] for a in before} - approved_ids
    if not unplanned.issubset(after_ids):
        raise RuntimeError('An unplanned artifact disappeared; inspect concurrent activity')
    if any(a['id'] not in after_ids for a in plan['preserve_artifacts']):
        raise RuntimeError('A current/rollback artifact is missing')
    final_releases = release_snapshot(pages('/releases'))
    if any(final_releases.get(ident) != meta for ident, meta in protected_releases.items()):
        raise RuntimeError('An existing release asset changed; inspect concurrent activity')
    result = {
        'removed_count': len(removed),
        'removed_bytes': sum(a['size_in_bytes'] for a in targets),
        'already_absent_count': len(absent),
        'remaining_artifacts': len(after),
        'remaining_artifact_bytes': sum(a['size_in_bytes'] for a in after),
        'preserved_current_and_previous_artifacts': 6,
        'all_unplanned_artifacts_preserved': True,
        'all_release_assets_and_signing_identity_preserved': True,
        'source_history_runs_caches_and_keyboard_untouched': True,
    }
    print('CENA_CLEANUP_RESULT ' + json.dumps(result), flush=True)
    Path(os.environ['GITHUB_STEP_SUMMARY']).write_text(
        '# Limpeza aprovada do CENA\n\n```json\n'
        + json.dumps(result, indent=2) + '\n```\n')


if __name__ == '__main__':
    main()
