(() => {
  'use strict';

  const normalise = value => String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/µ/g, 'u')
    .replace(/²/g, '2')
    .replace(/[^a-z0-9%/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const types = {
    auto: {
      id: 'auto', label: 'Auto-detect', short: 'Auto', preview: 'auto',
      description: 'Let LabFlow inspect filename, headers and units.'
    },
    jv: {
      id: 'jv', label: 'JV', short: 'J–V', preview: 'jv',
      description: 'Illuminated current–voltage measurement.',
      columns: {
        x: ['voltage', 'bias', 'potential', 'voltage v', 'v'],
        y: ['current density', 'currentdensity', 'current density ma/cm2', 'j ma/cm2', 'j', 'current', 'ma cm2']
      },
      units: { x: 'V', y: 'mA/cm²' },
      recommended: [
        { id: 'activeArea', label: 'Active device area', why: 'Used to verify current-density normalisation and compare JV measurements.', placeholder: 'e.g. 0.16 cm²', unit: 'cm²' },
        { id: 'illumination', label: 'Illumination conditions', why: 'Needed to interpret efficiency and reproduce the illuminated scan.', placeholder: 'e.g. AM1.5G · 100 mW/cm²' },
        { id: 'instrument', label: 'JV instrument', why: 'Improves acquisition provenance.', placeholder: 'Instrument / setup' }
      ]
    },
    dark_jv: {
      id: 'dark_jv', label: 'Dark JV', short: 'Dark J–V', preview: 'jv',
      description: 'Current–voltage measurement without illumination.',
      columns: {
        x: ['voltage', 'bias', 'potential', 'voltage v', 'v'],
        y: ['current density', 'currentdensity', 'current density ma/cm2', 'j ma/cm2', 'j', 'current', 'ma cm2']
      },
      units: { x: 'V', y: 'mA/cm²' },
      recommended: [
        { id: 'activeArea', label: 'Active device area', why: 'Improves comparison with illuminated JV data and device-to-device scans.', placeholder: 'e.g. 0.16 cm²', unit: 'cm²' },
        { id: 'instrument', label: 'JV instrument', why: 'Improves acquisition provenance.', placeholder: 'Instrument / setup' }
      ]
    },
    ipce: {
      id: 'ipce', label: 'IPCE', short: 'IPCE / EQE', preview: 'spectrum',
      description: 'Wavelength-dependent incident photon conversion efficiency.',
      columns: {
        x: ['wavelength', 'wavelength nm', 'lambda', 'lambda nm', 'nm'],
        y: ['ipce', 'eqe', 'quantum efficiency', 'external quantum efficiency', 'response']
      },
      units: { x: 'nm', y: '%' },
      recommended: [
        { id: 'instrument', label: 'IPCE instrument', why: 'Improves provenance and later reproduction.', placeholder: 'Instrument / setup' }
      ]
    },
    uvvis: {
      id: 'uvvis', label: 'UV/VIS', short: 'UV/VIS', preview: 'spectrum',
      description: 'Absorbance, transmittance or optical-density spectrum.',
      columns: {
        x: ['wavelength', 'wavelength nm', 'lambda', 'lambda nm', 'nm'],
        y: ['absorbance', 'transmittance', 'transmission', 'optical density', 'od', 'abs']
      },
      units: { x: 'nm', y: 'a.u.' },
      recommended: [
        { id: 'instrument', label: 'UV/VIS instrument', why: 'Improves provenance and comparison across instruments.', placeholder: 'Instrument / setup' }
      ]
    },
    stability: {
      id: 'stability', label: 'Stability', short: 'Stability', preview: 'timeline',
      description: 'Performance or device metric evolving over time.',
      columns: {
        x: ['time', 'elapsed time', 'elapsed', 'duration', 'hours', 'hour', 'minutes', 'minute', 'time h'],
        y: ['pce', 'voc', 'jsc', 'ff', 'retention', 'normalized performance', 'normalised performance', 'performance']
      },
      units: { x: 'h', y: '%' },
      recommended: [
        { id: 'environment', label: 'Test environment', why: 'Temperature, humidity and atmosphere are important for stability reproducibility.', placeholder: 'e.g. N₂ · 25 °C · dark' },
        { id: 'protocol', label: 'Stability protocol', why: 'Clarifies illumination, tracking mode and measurement cadence.', placeholder: 'e.g. MPPT · continuous illumination' },
        { id: 'instrument', label: 'Stability setup', why: 'Improves provenance of long-running tests.', placeholder: 'Instrument / setup' }
      ]
    },
    generic: {
      id: 'generic', label: 'Other / Generic', short: 'Generic', preview: 'table',
      description: 'Structured evidence without a supported measurement semantic.',
      recommended: []
    }
  };

  const realTypes = Object.values(types).filter(type => !['auto', 'generic'].includes(type.id));
  const typeFromLegacy = value => {
    const text = normalise(value);
    if (!text) return 'generic';
    if (/dark.*j.?v|j.?v.*dark/.test(text)) return 'dark_jv';
    if (/\bipce\b|\beqe\b/.test(text)) return 'ipce';
    if (/uv.?vis|absorb|transmitt|optical/.test(text)) return 'uvvis';
    if (/stabil|aging|ageing|lifetime|mppt/.test(text)) return 'stability';
    if (/\bj.?v\b|current.?voltage/.test(text)) return 'jv';
    return 'generic';
  };

  const matches = (column, aliases) => aliases.some(alias => {
    const a = normalise(alias), c = normalise(column);
    if (!a || !c) return false;
    if (a.length === 1) return c === a;
    return c === a || c.includes(a) || a.includes(c);
  });

  function mapping(typeId, columns) {
    const type = types[typeId] || types.generic;
    if (!type.columns) return { x: -1, y: -1 };
    return {
      x: columns.findIndex(column => matches(column, type.columns.x)),
      y: columns.findIndex(column => matches(column, type.columns.y))
    };
  }

  function detect({ columns = [], filename = '' }) {
    const name = normalise(filename);
    const scores = realTypes.map(type => {
      const map = mapping(type.id, columns);
      let score = (map.x >= 0 ? 3 : 0) + (map.y >= 0 ? 5 : 0);
      const reasons = [];
      if (map.x >= 0 && map.y >= 0) reasons.push('matching headers');
      if (type.id === 'dark_jv' && /dark.*j.?v|dark iv|dark current/.test(name)) { score += 7; reasons.push('filename'); }
      if (type.id === 'jv' && /(^| )j.?v($| )|current voltage/.test(name) && !/dark/.test(name)) { score += 4; reasons.push('filename'); }
      if (type.id === 'ipce' && /ipce|eqe/.test(name)) { score += 6; reasons.push('filename'); }
      if (type.id === 'uvvis' && /uv.?vis|absorb|transmit|spectrum/.test(name)) { score += 5; reasons.push('filename'); }
      if (type.id === 'stability' && /stability|aging|ageing|lifetime|mppt/.test(name)) { score += 6; reasons.push('filename'); }
      return { type, score, map, reasons };
    }).sort((a, b) => b.score - a.score);
    const best = scores[0];
    return best && best.score >= 6
      ? { type: best.type, confidence: best.score >= 12 ? 'high' : best.score >= 8 ? 'medium' : 'low', mapping: best.map, reasons: best.reasons }
      : { type: types.generic, confidence: 'low', mapping: { x: -1, y: -1 }, reasons: ['No supported column pair found'] };
  }

  const number = value => {
    const cleaned = String(value ?? '').trim().replace(',', '.').replace(/\s/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  function series(typeId, columns, rows, map = mapping(typeId, columns)) {
    if (map.x < 0 || map.y < 0) return [];
    return rows
      .map(row => [number(row[map.x]), number(row[map.y])])
      .filter(pair => pair[0] !== null && pair[1] !== null);
  }

  function interpolateAtX(points, targetX) {
    const sorted = [...points].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if ((a[0] <= targetX && b[0] >= targetX) || (b[0] <= targetX && a[0] >= targetX)) {
        if (a[0] === b[0]) return a[1];
        return a[1] + (targetX - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
      }
    }
    return sorted.reduce((best, point) => Math.abs(point[0] - targetX) < Math.abs(best[0] - targetX) ? point : best, sorted[0])?.[1] ?? null;
  }

  function zeroCrossings(points) {
    const sorted = [...points].sort((a, b) => a[0] - b[0]), out = [];
    const add = value => { if (Number.isFinite(value) && !out.some(existing => Math.abs(existing - value) < 1e-9)) out.push(value); };
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (a[1] === 0) add(a[0]);
      if (b[1] === 0) add(b[0]);
      if (a[1] * b[1] < 0) add(a[0] + (0 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    return out;
  }

  function jvMetrics(points) {
    if (points.length < 2) return [];
    const jAtZero = interpolateAtX(points, 0);
    const crossings = zeroCrossings(points);
    const voc = crossings.length ? crossings.sort((a, b) => Math.abs(b) - Math.abs(a))[0] : null;
    const metrics = [];
    if (Number.isFinite(voc)) metrics.push({ id: 'voc', label: 'Voc', value: Math.abs(voc).toFixed(3), unit: 'V', source: 'calculated' });
    if (Number.isFinite(jAtZero)) metrics.push({ id: 'jsc', label: 'Jsc', value: Math.abs(jAtZero).toFixed(2), unit: 'mA/cm²', source: 'calculated' });
    if (Number.isFinite(voc) && Number.isFinite(jAtZero) && Math.abs(voc * jAtZero) > 1e-12) {
      const operatingPowers = points.map(([v, j]) => Math.abs(v * j));
      const pmax = Math.max(...operatingPowers);
      const ff = pmax / (Math.abs(voc) * Math.abs(jAtZero)) * 100;
      if (Number.isFinite(ff) && ff > 0 && ff <= 120) metrics.push({ id: 'ff', label: 'FF', value: ff.toFixed(1), unit: '%', source: 'calculated' });
    }
    return metrics;
  }

  function summary(typeId, points) {
    if (!points.length) return [];
    if (['jv', 'dark_jv'].includes(typeId)) return jvMetrics(points);
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    if (typeId === 'stability') {
      const initial = ys[0], final = ys.at(-1), duration = Math.max(...xs) - Math.min(...xs);
      return [
        { id: 'duration', label: 'Duration', value: duration.toFixed(1), unit: types[typeId].units.x, source: 'calculated' },
        { id: 'initial', label: 'Initial', value: initial.toFixed(2), unit: types[typeId].units.y, source: 'imported' },
        { id: 'final', label: 'Final', value: final.toFixed(2), unit: types[typeId].units.y, source: 'imported' },
        ...(initial ? [{ id: 'retention', label: 'Retention', value: (final / initial * 100).toFixed(1), unit: '%', source: 'calculated' }] : [])
      ];
    }
    return [
      { id: 'range', label: 'Range', value: `${Math.min(...xs).toFixed(0)}–${Math.max(...xs).toFixed(0)}`, unit: types[typeId].units.x, source: 'calculated' },
      { id: 'response', label: 'Response', value: `${Math.min(...ys).toFixed(2)}–${Math.max(...ys).toFixed(2)}`, unit: types[typeId].units.y, source: 'imported' }
    ];
  }

  function typeFor(dataset) {
    return types[dataset?.measurementType] || types[typeFromLegacy(dataset?.measurement)] || types.generic;
  }

  window.LabFlowMeasurements = Object.freeze({
    types, realTypes, detect, mapping, series, summary, normalise, typeFromLegacy, typeFor
  });
})();
