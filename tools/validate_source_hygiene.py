#!/usr/bin/env python3
"""Guard maintainability boundaries that are easy to accidentally bypass."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []
warnings = []


def text(path):
    return (ROOT / path).read_text(encoding='utf-8')


def forbid(path, pattern, message):
    source = text(path)
    if re.search(pattern, source, re.MULTILINE):
        errors.append(f'{path}: {message}')


# The application shell delegates scientific writes to owners.
forbid('assets/js/app.js', r'S\.state\.experiment\.design\b', 'direct Design root access bypasses DesignModel')
forbid('assets/js/app.js', r'\.design\.(?:devices|solutions)\.(?:push|splice)\s*\(', 'direct Design collection mutation bypasses DesignModel')
forbid('assets/js/app.js', r'\.stack\.(?:push|splice)\s*\(', 'direct Design layer mutation bypasses DesignModel')
forbid('assets/js/app.js', r"C\.uid\(['\"](?:device|sol|layer)['\"]", 'UI creates Design records directly')

# DesignAnalysis decides policy, but DesignModel owns every Design write.
forbid('assets/js/experiment/design-analysis.js', r'exp\.design\b', 'DesignAnalysis must use DesignModel selectors/mutators')
forbid('assets/js/experiment/design-analysis.js', r'\.design\.(?:devices|solutions)\.(?:push|splice)\s*\(', 'DesignAnalysis mutates Design collections directly')

# DatasetCorrections may rebuild canonical samples, but record shape still belongs to DomainSchema.
forbid('assets/js/data/dataset-corrections.js', r"sample\s*=\s*\{[^\n]*kind\s*:\s*['\"]sample['\"]", 'DatasetCorrections manually defines the sample record shape')

# AI orchestration must not own deterministic scientific services.
forbid('assets/js/ai/action-steps.js', r'LF\.DatasetCorrections\s*=', 'DatasetCorrections belongs to data/dataset-corrections.js')
forbid('assets/js/ai/action-steps.js', r'LF\.DesignAnalysis\s*=', 'DesignAnalysis belongs to experiment/design-analysis.js')

# External/persisted data has one strict restore path.
if 'DM.restore(data)' not in text('assets/js/data/importer.js'):
    errors.append('assets/js/data/importer.js: LabFlow save restore must use DataModel.restore()')
if 'DataContracts.assertSnapshot(snapshot)' not in text('assets/js/experiment/data-model.js'):
    errors.append('assets/js/experiment/data-model.js: persisted restore must validate before hydrate')
if 'schemaVersion' in text('assets/js/storage.js'):
    errors.append('assets/js/storage.js: Knowledge Base must not persist a parallel schema-version wrapper')
if 'schema_version' in text('tools/build_knowledge_bundle.py'):
    errors.append('tools/build_knowledge_bundle.py: generated KB must not introduce a schema-version wrapper')

# Never commit developer identity or workstation-specific model paths into runtime defaults.
for path in ['assets/js/app.js', 'assets/js/storage.js', 'labflow_engine.sh']:
    source = text(path)
    if 'Matteo Ginesi' in source:
        errors.append(f'{path}: developer identity is hard-coded')
    if re.search(r'/home/[^/]+/.*(?:LM Studio|lmstudio|\.gguf)', source, re.I):
        errors.append(f'{path}: developer-specific model path is hard-coded')

# Classic scripts are acceptable, but required architectural dependencies must be explicit.
for path in [
    'assets/js/experiment/data-model.js',
    'assets/js/state.js',
    'assets/js/experiment/design-model.js',
    'assets/js/data/dataset-corrections.js',
    'assets/js/experiment/design-analysis.js',
    'assets/js/data/pipeline.js',
    'assets/js/ai/action-steps.js',
]:
    source = text(path)
    if re.search(r'const\s+C\s*=\s*LF\.Core\s*\|\|\s*\{\}', source):
        errors.append(f'{path}: required Core dependency is hidden behind a fallback object')

# Keep track of readability debt without blocking unrelated work. New/edited core files
# should be formatted; remaining warnings identify older dense modules for later passes.
GENERATED = {'action-registry.js', 'prompt-bundle.js', 'kb-bundle.js', 'docs-bundle.js', 'ui-kit-inline.js'}
for path in sorted((ROOT / 'assets/js').rglob('*.js')):
    if path.name in GENERATED:
        continue
    long_count = sum(1 for line in path.read_text(encoding='utf-8', errors='ignore').splitlines() if len(line) > 400)
    if long_count:
        warnings.append(f'{path.relative_to(ROOT)}: {long_count} lines exceed 400 characters')

if errors:
    print('Source hygiene: FAILED')
    for error in errors:
        print(' -', error)
    sys.exit(1)

print('Source hygiene: OK (owner boundaries, strict restore, no version wrappers/hard-coded developer defaults)')
if warnings:
    print(f'Source hygiene: {len(warnings)} readability warnings remain in older dense modules')
    for warning in warnings[:12]:
        print(' ~', warning)
    if len(warnings) > 12:
        print(f' ~ ... {len(warnings) - 12} more')
