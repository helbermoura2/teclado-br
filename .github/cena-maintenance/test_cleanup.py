import copy
import json
from pathlib import Path
import unittest
import cleanup


class ApprovedPlanTest(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads(Path(__file__).with_name('plan.json').read_text())
        self.rows = [{'id': e['id'], 'name': e['name'], 'size_in_bytes': e['bytes'],
                      'workflow_run': {'id': e['run_id'], 'head_branch': 'cena/android-preview'}}
                     for e in self.plan['preserve_artifacts'] + self.plan['delete_artifacts']]

    def test_only_the_approved_108_are_selected(self):
        targets, absent = cleanup.validate(self.plan, self.rows)
        self.assertEqual(len(targets), 108)
        self.assertEqual(absent, [])
        self.assertEqual(sum(t['size_in_bytes'] for t in targets), 4691816324)

    def test_unknown_artifacts_are_preserved(self):
        self.rows += [{'id': 1, 'name': 'keyboard-private-signing', 'size_in_bytes': 100,
                       'workflow_run': {'id': 2, 'head_branch': 'main'}}]
        targets, _ = cleanup.validate(self.plan, self.rows)
        self.assertNotIn(1, [t['id'] for t in targets])

    def test_changed_artifact_size_is_rejected(self):
        self.rows[-1]['size_in_bytes'] += 1
        with self.assertRaises(ValueError):
            cleanup.validate(self.plan, self.rows)

    def test_changed_run_or_branch_is_rejected(self):
        for field, value in [('id', 999), ('head_branch', 'main')]:
            rows = copy.deepcopy(self.rows)
            rows[-1]['workflow_run'][field] = value
            with self.assertRaises(ValueError):
                cleanup.validate(self.plan, rows)

    def test_protected_or_unknown_names_are_rejected(self):
        for name in ['cena-preview.keystore', 'CENA-signing', 'teclado-br-heli-apk']:
            plan = copy.deepcopy(self.plan)
            plan['delete_artifacts'][-1]['name'] = name
            with self.assertRaises(ValueError):
                cleanup.validate(plan, self.rows)

    def test_missing_preserved_artifact_is_rejected(self):
        with self.assertRaises(ValueError):
            cleanup.validate(self.plan, self.rows[1:])

    def test_duplicate_and_protected_ids_are_rejected(self):
        for ident in [self.rows[0]['id'], self.rows[-2]['id']]:
            plan = copy.deepcopy(self.plan)
            plan['delete_artifacts'][-1]['id'] = ident
            with self.assertRaises(ValueError):
                cleanup.validate(plan, self.rows)

    def test_previously_removed_artifacts_are_safe_to_skip(self):
        targets, absent = cleanup.validate(self.plan, self.rows[:-1])
        self.assertEqual(len(targets), 107)
        self.assertEqual(absent, [self.rows[-1]['id']])


if __name__ == '__main__':
    unittest.main()
