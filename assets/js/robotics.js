(function () {
  "use strict";

  const CONFIG = window.LabFlowRoboticsConfig || {};
  const Log = window.LabFlowLogger?.child("robotics") || {debug(){},info(){},warn(){},error(){},time(){return () => {};} };
  const asArray = (value) => Array.isArray(value) ? value : [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const rad = (degrees) => Number(degrees || 0) * Math.PI / 180;
  const fmt = (value, digits = 1) => Number(value || 0).toFixed(digits);
  const nowTime = () => new Date().toLocaleTimeString("en-GB", {hour12:false});
  const waitTick = () => new Promise((resolve) => setTimeout(resolve, 35));

  function buildState() {
    const joints = {};
    asArray(CONFIG.joints).forEach((joint) => { joints[joint.id] = Number(joint.home_deg || 0); });
    const programs = asArray(CONFIG.programs);
    return {
      mode: "simulation",
      controller: "Ready",
      safety: "Normal",
      joints: {...joints},
      target: {...joints},
      velocity: Object.fromEntries(Object.keys(joints).map((id) => [id, 0])),
      speed: 48,
      gripper: "open",
      overlays: {frames:false, target:true, trajectory:true, grid:true},
      camera: {yaw:-0.72, pitch:0.42, zoom:1.0, target:{x:175,y:0,z:190}},
      trajectory: [],
      jointTrajectory: [],
      poses: clone(asArray(CONFIG.poses)),
      programs: clone(programs),
      selectedProgramId: programs[0]?.id || "sample-inspection",
      selectedPose: "",
      motion: null,
      paused: false,
      executionToken: 0,
      execution: {status:"idle", index:-1, steps:[], startedAt:0, elapsed:0, programName:"None", message:"No program running"},
      logs: [],
      integration: {...(CONFIG.integration || {}), attachNext:true, last:null},
      lastCommand: "Initialised",
      redraw: true,
      destroyed: false
    };
  }

  function forwardKinematics(joints) {
    const links = CONFIG.links || {};
    const baseHeight = Number(links.base_height_mm || 145);
    const l1 = Number(links.link_1_mm || 260);
    const l2 = Number(links.link_2_mm || 220);
    const toolLength = Number(links.tool_length_mm || 72);
    const a1 = rad(joints.j1);
    const a2 = rad(joints.j2);
    const a3 = rad(joints.j3);
    const shoulder = {x:0, y:0, z:baseHeight};
    const elbow = {
      x: l1 * Math.cos(a2) * Math.cos(a1),
      y: l1 * Math.cos(a2) * Math.sin(a1),
      z: baseHeight + l1 * Math.sin(a2)
    };
    const toolAngle = a2 + a3;
    const wrist = {
      x: elbow.x + l2 * Math.cos(toolAngle) * Math.cos(a1),
      y: elbow.y + l2 * Math.cos(toolAngle) * Math.sin(a1),
      z: elbow.z + l2 * Math.sin(toolAngle)
    };
    const direction = {
      x: Math.cos(toolAngle) * Math.cos(a1),
      y: Math.cos(toolAngle) * Math.sin(a1),
      z: Math.sin(toolAngle)
    };
    const tool = {
      x: wrist.x + toolLength * direction.x,
      y: wrist.y + toolLength * direction.y,
      z: wrist.z + toolLength * direction.z
    };
    return {
      base:{x:0,y:0,z:0}, shoulder, elbow, wrist, tool, direction,
      distance: Math.hypot(tool.x, tool.y, tool.z)
    };
  }

  function programToYaml(program) {
    const lines = [`name: ${program.name || "motion_program"}`, `speed: ${Number(program.speed || 0.6).toFixed(2)}`, "", "sequence:"];
    asArray(program.sequence).forEach((step) => {
      if (step.pose) lines.push(`  - pose: ${step.pose}`);
      else if (step.gripper) lines.push(`  - gripper: ${step.gripper}`);
      else if (step.wait_ms !== undefined && Object.keys(step).length === 1) lines.push(`  - wait_ms: ${step.wait_ms}`);
      else if (step.joints) lines.push(`  - joints: {j1: ${step.joints.j1}, j2: ${step.joints.j2}, j3: ${step.joints.j3}}`);
      else if (step.comment) lines.push(`  - comment: ${step.comment}`);
      else lines.push("  - comment: unsupported step");
      if (step.duration_ms !== undefined) lines.push(`    duration_ms: ${step.duration_ms}`);
      if (step.wait_ms !== undefined && !(step.wait_ms !== undefined && Object.keys(step).length === 1)) lines.push(`    wait_ms: ${step.wait_ms}`);
      if (step.speed !== undefined) lines.push(`    speed: ${step.speed}`);
    });
    return `${lines.join("\n")}\n`;
  }

  function scalar(value) {
    const clean = String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
    if (/^-?\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
    if (clean === "true") return true;
    if (clean === "false") return false;
    return clean;
  }

  function parseInlineJoints(source) {
    const body = source.trim().replace(/^\{/, "").replace(/\}$/, "");
    const result = {};
    body.split(",").forEach((part) => {
      const match = part.match(/^\s*(j[123])\s*:\s*(-?\d+(?:\.\d+)?)\s*$/i);
      if (match) result[match[1].toLowerCase()] = Number(match[2]);
    });
    return result;
  }

  function parseProgram(text) {
    const program = {name:"motion_program", speed:0.6, sequence:[]};
    const lines = String(text || "").split(/\r?\n/);
    let current = null;
    let inSequence = false;
    lines.forEach((raw, lineIndex) => {
      const withoutComment = raw.replace(/\s+#.*$/, "");
      if (!withoutComment.trim()) return;
      const indent = withoutComment.match(/^\s*/)[0].length;
      const line = withoutComment.trim();
      if (indent === 0 && line.startsWith("name:")) { program.name = scalar(line.slice(5)); return; }
      if (indent === 0 && line.startsWith("speed:")) { program.speed = Number(scalar(line.slice(6))); return; }
      if (indent === 0 && line === "sequence:") { inSequence = true; return; }
      if (!inSequence) return;
      if (line.startsWith("- ")) {
        current = {_line: lineIndex + 1};
        program.sequence.push(current);
        const pair = line.slice(2).match(/^([a-z_]+)\s*:\s*(.*)$/i);
        if (!pair) { current._parseError = "Expected an action key after '-'"; return; }
        const key = pair[1];
        const value = pair[2];
        if (key === "joints") current.joints = parseInlineJoints(value);
        else current[key] = scalar(value);
        return;
      }
      if (current) {
        const pair = line.match(/^([a-z0-9_]+)\s*:\s*(.*)$/i);
        if (!pair) { current._parseError = "Expected key: value"; return; }
        const key = pair[1];
        if (key.match(/^j[123]$/) && current.joints) current.joints[key] = Number(scalar(pair[2]));
        else current[key] = scalar(pair[2]);
      }
    });
    return program;
  }

  function validateProgram(program, poses) {
    const errors = [];
    const supported = new Set(["pose","joints","wait_ms","duration_ms","speed","gripper","comment","_line","_parseError"]);
    if (!program.name) errors.push("Program name is required.");
    if (!Number.isFinite(program.speed) || program.speed <= 0 || program.speed > 1.5) errors.push("Program speed must be between 0 and 1.5.");
    if (!Array.isArray(program.sequence) || !program.sequence.length) errors.push("The sequence must contain at least one step.");
    const poseNames = new Set(poses.map((pose) => pose.name));
    asArray(program.sequence).forEach((step, index) => {
      const line = step._line ? `Line ${step._line}` : `Step ${index + 1}`;
      if (step._parseError) errors.push(`${line}: ${step._parseError}.`);
      Object.keys(step).forEach((key) => { if (!supported.has(key)) errors.push(`${line}: unsupported key '${key}'.`); });
      const actions = [step.pose !== undefined, step.joints !== undefined, step.wait_ms !== undefined, step.gripper !== undefined, step.comment !== undefined].filter(Boolean).length;
      if (!actions) errors.push(`${line}: no supported action.`);
      if (step.pose && !poseNames.has(String(step.pose))) errors.push(`${line}: pose '${step.pose}' does not exist.`);
      if (step.joints) {
        asArray(CONFIG.joints).forEach((joint) => {
          const value = Number(step.joints[joint.id]);
          if (!Number.isFinite(value)) errors.push(`${line}: ${joint.id} is missing or invalid.`);
          else if (value < joint.min_deg || value > joint.max_deg) errors.push(`${line}: ${joint.id} ${value}° is outside ${joint.min_deg}° / ${joint.max_deg}°.`);
        });
      }
      if (step.gripper && !["open","close"].includes(String(step.gripper))) errors.push(`${line}: gripper must be open or close.`);
      ["wait_ms","duration_ms"].forEach((key) => { if (step[key] !== undefined && (!Number.isFinite(Number(step[key])) || Number(step[key]) < 0)) errors.push(`${line}: ${key} must be a non-negative number.`); });
    });
    return errors;
  }

  function stepLabel(step) {
    if (step.pose) return `Move to ${step.pose}`;
    if (step.joints) return `Joint target ${fmt(step.joints.j1,0)}° / ${fmt(step.joints.j2,0)}° / ${fmt(step.joints.j3,0)}°`;
    if (step.gripper) return `Gripper ${step.gripper}`;
    if (step.wait_ms !== undefined) return `Wait ${step.wait_ms} ms`;
    return step.comment || "Comment";
  }

  function renderBase({root, header, icon, esc, toast}) {
    const state = buildState();
    const ui = {};
    const jointHtml = asArray(CONFIG.joints).map((joint) => `<section class="robotics-joint" data-joint="${joint.id}">
      <div class="robotics-joint-title">
        <span><i></i><strong>${esc(joint.id.toUpperCase())}</strong><small>${esc(joint.name)}</small></span>
        <output data-current="${joint.id}">${fmt(joint.home_deg)}°</output>
      </div>
      <div class="robotics-joint-control">
        <button class="btn btn-sm icon-btn" type="button" data-jog="${joint.id}" data-delta="-1" aria-label="Decrease ${esc(joint.name)} by one degree">−</button>
        <input id="robot-${joint.id}" type="range" min="${joint.min_deg}" max="${joint.max_deg}" step="0.5" value="${joint.home_deg}" aria-label="${esc(joint.name)} joint angle">
        <button class="btn btn-sm icon-btn" type="button" data-jog="${joint.id}" data-delta="1" aria-label="Increase ${esc(joint.name)} by one degree">+</button>
      </div>
      <div class="robotics-joint-limits"><span>${joint.min_deg}°</span><span>${joint.max_deg}°</span></div>
    </section>`).join("");

    const programOptions = state.programs.map((program) => `<option value="${esc(program.id)}">${esc(program.name)}</option>`).join("");
    const projectOptions = asArray(window.LabFlowData?.projects).map((project) => `<option value="${esc(project.id)}" ${project.id === state.integration.experiment ? "selected" : ""}>${esc(project.id)} · ${esc(project.name)}</option>`).join("");

    root.innerHTML = header(
      "Robotics",
      "Simulate, configure and control robotic systems connected to laboratory workflows.",
      `<button class="btn btn-primary" id="robot-run-demo" type="button">${icon("play")} Run sample demo</button>`,
      {eyebrow:"Platform capability", status:'<span class="badge badge-accent">Simulation ready</span>'}
    ) + `<div class="robotics-page">
      <section class="robotics-status-strip" aria-label="Robotics status summary">
        <article class="robotics-status-card robotics-status-card-primary"><span>${icon("robot")}</span><div><strong>${esc(CONFIG.name || "Robot Arm 01")}</strong><small>${asArray(CONFIG.joints).length}-axis articulated arm · local simulation</small></div></article>
        <article class="robotics-status-card"><span>Mode</span><div class="robotics-mode-control"><div class="segmented" role="group" aria-label="Robot mode"><button class="active" type="button" data-mode="simulation">Simulation</button><button type="button" data-mode="hardware">Hardware</button></div></div></article>
        <article class="robotics-status-card"><span>Controller</span><strong id="robot-controller-status">Ready</strong><small><span id="robot-safety-status">Normal</span> · joint limits active</small></article>
        <article class="robotics-status-card"><span>Motion</span><strong id="robot-active-program">None</strong><small><span id="robot-program-state">Idle</span> · <span id="robot-pose-count">${state.poses.length}</span> saved poses</small></article>
      </section>

      <div class="robotics-hardware-note" id="robot-hardware-note" hidden>${icon("warning")}<span><strong>Hardware adapter not configured.</strong> The interface remains honest: only Simulation can move the arm.</span></div>

      <section class="robotics-workbench">
        <div class="robotics-stage-panel">
          <div class="robotics-stage-toolbar">
            <div><h2>Robot control</h2><p>Joint-space simulation with forward kinematics</p></div>
            <div class="cluster robotics-view-options" aria-label="Canvas display options">
              ${Object.entries({frames:"Frames",target:"Target",trajectory:"Trail"}).map(([key,label]) => `<label class="robotics-overlay-toggle"><input type="checkbox" data-overlay="${key}" ${state.overlays[key] ? "checked" : ""}>${label}</label>`).join("")}
              <button class="btn btn-sm" id="robot-view-reset" type="button">${icon("curve")} Reset view</button>
            </div>
          </div>
          <div class="robotics-canvas-wrap">
            <canvas id="robot-3d-canvas" aria-label="Interactive three-dimensional robot arm simulation"></canvas>
            <div class="robotics-canvas-status" aria-live="polite">
              <span class="badge badge-success" id="robot-hud-motion">READY</span>
              <span>TCP <strong id="robot-hud-tcp">0 · 0 · 0 mm</strong></span>
              <span class="robotics-canvas-hint">Drag to rotate · scroll to zoom</span>
            </div>
          </div>
        </div>
        <aside class="robotics-control-panel">
          <div class="robotics-control-head"><div><h2>Joint control</h2><p>Base yaw, shoulder and elbow</p></div><span class="robotics-gripper is-open" id="robot-gripper"><i></i><span>Gripper open</span></span></div>
          <div class="robotics-control-body">${jointHtml}</div>
          <div class="robotics-global-controls">
            <div class="robotics-global-actions"><button class="btn btn-primary" id="robot-home" type="button">${icon("home")} Home</button><button class="btn btn-danger" id="robot-stop" type="button">${icon("x")} Stop</button></div>
            <div class="robotics-speed-row"><label for="robot-speed">Motion speed</label><input id="robot-speed" type="range" min="10" max="100" step="1" value="${state.speed}"><output id="robot-speed-value">${state.speed}°/s</output></div>
          </div>
          <div class="robotics-kinematics"><div><span>TCP position</span><strong id="robot-x">0.0</strong><small id="robot-y">0.0</small><small id="robot-z">0.0</small></div><div><span>Reach</span><strong id="robot-distance">0.0 mm</strong><small id="robot-validity">Valid</small></div><div><span>Tool direction</span><strong id="robot-direction">0 / 0 / 0</strong></div></div>
        </aside>
      </section>

      <section class="robotics-mid-grid">
        <div class="robotics-subpanel"><div class="robotics-subpanel-header"><h2>2. Configuration Space</h2><div class="robotics-config-controls"><label class="sr-only" for="robot-config-plane">Plane</label><select class="select" id="robot-config-plane"><option value="j1,j2">J1 × J2</option><option value="j1,j3">J1 × J3</option><option value="j2,j3">J2 × J3</option></select></div></div><div class="robotics-subpanel-body"><canvas class="robotics-config-canvas" id="robot-config-canvas" aria-label="Two-dimensional robot configuration space"></canvas><div class="robotics-legend"><span><i></i>Current</span><span><i></i>Target</span><span><i></i>Simulated invalid zone</span></div></div></div>
        <div class="robotics-subpanel"><div class="robotics-subpanel-header"><h2>3. Saved Poses</h2><span class="badge">Session only</span></div><div class="robotics-subpanel-body"><div class="table-wrap"><table class="robotics-pose-table"><thead><tr><th>Name</th><th>J1</th><th>J2</th><th>J3</th><th>Actions</th></tr></thead><tbody id="robot-pose-rows"></tbody></table></div><div class="robotics-pose-editor"><input class="input" id="robot-pose-name" placeholder="Pose name" aria-label="Pose name"><button class="btn btn-primary" id="robot-save-pose" type="button">${icon("plus")} Save current</button></div></div></div>
        <div class="robotics-subpanel"><div class="robotics-subpanel-header"><h2>4. Motion Programs</h2><div class="cluster"><select class="select" id="robot-program-select" aria-label="Motion program">${programOptions}</select><button class="btn btn-sm" id="robot-new-program" type="button">New</button></div></div><div class="robotics-program-layout"><div class="robotics-program-editor"><textarea id="robot-program-editor" spellcheck="false" aria-label="Motion program YAML"></textarea></div><div class="robotics-program-summary"><div class="robotics-program-summary-list" id="robot-program-summary"></div><div class="robotics-program-feedback" id="robot-program-feedback">Validate the program before execution.</div></div></div><div class="robotics-program-actions"><button class="btn btn-sm" id="robot-import-program" type="button">${icon("upload")} Import</button><input id="robot-import-file" type="file" accept=".yaml,.yml,.txt" hidden><button class="btn btn-sm" id="robot-download-program" type="button">${icon("download")} Download</button><button class="btn btn-sm" id="robot-validate-program" type="button">${icon("check")} Validate</button><button class="btn btn-sm btn-primary" id="robot-run-program" type="button">${icon("play")} Run</button></div></div>
      </section>

      <section class="robotics-lower-grid">
        <div class="robotics-subpanel"><div class="robotics-subpanel-header"><h2>5. Execution Monitor</h2><div class="cluster"><span class="badge" id="robot-execution-badge">Idle</span><button class="btn btn-sm" id="robot-pause-program" type="button">Pause</button><button class="btn btn-sm" id="robot-resume-program" type="button" disabled>Resume</button><button class="btn btn-sm" id="robot-stop-program" type="button">Stop</button></div></div><div class="robotics-execution"><div class="robotics-execution-main"><div class="robotics-execution-title"><strong id="robot-execution-message">No program running</strong><span id="robot-execution-percent">0%</span></div><div class="robotics-progress" aria-label="Program progress"><span id="robot-progress-bar"></span></div><div class="robotics-timeline" id="robot-timeline"></div></div><div class="robotics-execution-stats"><div><span>Elapsed</span><strong id="robot-elapsed">00:00.0</strong></div><div><span>Step</span><strong id="robot-current-step">—</strong></div><div><span>Total</span><strong id="robot-total-steps">0</strong></div></div></div></div>
        <div class="robotics-subpanel"><div class="robotics-subpanel-header"><h2>End Effector</h2><span class="badge badge-success" id="robot-end-status">Within limits</span></div><div class="robotics-subpanel-body"><div class="metadata-list"><div><span>Position</span><strong id="robot-position-vector">[0, 0, 0] mm</strong></div><div><span>Direction</span><strong id="robot-tool-vector">[0, 0, 0]</strong></div><div><span>Joint vector</span><strong id="robot-joint-vector">[0°, 0°, 0°]</strong></div><div><span>Last command</span><strong id="robot-last-command">Initialised</strong></div></div><button class="btn btn-block mt-1" id="robot-set-target" type="button">Set current point as target</button></div></div>
      </section>

      <section class="robotics-subpanel"><div class="robotics-subpanel-header"><h2>6. Robot State & Telemetry</h2><span class="badge badge-success">Local simulation</span></div><div class="robotics-telemetry-grid"><div class="robotics-telemetry-section"><h3>Robot State</h3><div class="robotics-state-list"><div><span>State</span><strong id="robot-state">Ready</strong></div><div><span>Mode</span><strong id="robot-mode">Simulation</strong></div><div><span>Controller</span><strong id="robot-controller">Simulation</strong></div><div><span>Safety</span><strong id="robot-safety">Normal</strong></div><div><span>Current pose</span><strong id="robot-current-pose">Custom</strong></div><div><span>Gripper</span><strong id="robot-gripper-state">Open</strong></div></div></div><div class="robotics-telemetry-section"><h3>Joint Telemetry</h3><table class="robotics-telemetry-table"><thead><tr><th>Joint</th><th>Position</th><th>Target</th><th>Velocity</th><th>Limits</th></tr></thead><tbody id="robot-telemetry-rows"></tbody></table></div><div class="robotics-telemetry-section"><h3>Event Log</h3><div class="robotics-event-log" id="robot-event-log" aria-live="polite"></div></div></div></section>

      <section class="robotics-subpanel"><div class="robotics-subpanel-header"><h2>7. Experiment Integration</h2><span class="badge">Demonstration link</span></div><div class="robotics-integration-grid"><div><div class="robotics-integration-form"><div class="field"><label for="robot-workspace">Workspace</label><input class="input" id="robot-workspace" value="${esc(state.integration.workspace || window.LabFlowData?.user?.workspace || "Advanced Photovoltaics")}"></div><div class="field"><label for="robot-experiment">Experiment</label><select class="select" id="robot-experiment">${projectOptions}</select></div><div class="field"><label for="robot-sample">Sample</label><input class="input" id="robot-sample" value="${esc(state.integration.sample || "SAMPLE-08")}"></div><div class="field"><label for="robot-process-step">Process step</label><input class="input" id="robot-process-step" value="${esc(state.integration.process_step || "Visual inspection")}"></div><div class="field"><label for="robot-operation">Operation description</label><input class="input" id="robot-operation" value="${esc(state.integration.operation || "Visual inspection with robotic arm")}"></div></div><label class="form-check form-switch mt-1"><input class="form-check-input" id="robot-attach-next" type="checkbox" checked><span class="form-check-label">Attach the next completed execution to this experiment</span></label></div><div class="robotics-integration-result"><h3>Last execution</h3><div class="metadata-list" id="robot-integration-result"><div><span>Status</span><strong>No attached execution</strong></div><div><span>Evidence</span><strong>Execution log pending</strong></div></div></div></div></section>
    </div>`;

    function q(selector) { return root.querySelector(selector); }
    function qa(selector) { return [...root.querySelectorAll(selector)]; }
    ui.scene = q("#robot-3d-canvas");
    ui.config = q("#robot-config-canvas");
    ui.editor = q("#robot-program-editor");

    function event(message, level = "info", detail = {}) {
      const record = {time:nowTime(), level, message};
      state.logs.unshift(record);
      state.logs = state.logs.slice(0, 80);
      (Log[level] || Log.info).call(Log, message, detail);
      renderLogs();
    }

    function setHardwareDisabled(disabled) {
      qa("[data-joint] input, [data-jog], #robot-home, #robot-speed, #robot-run-demo, #robot-run-program, #robot-set-target").forEach((control) => { control.disabled = disabled; });
    }

    function setMode(mode) {
      state.mode = mode;
      qa("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
      const hardware = mode === "hardware";
      q("#robot-hardware-note").hidden = !hardware;
      state.controller = hardware ? "Not configured" : "Ready";
      q("#robot-controller-status").textContent = state.controller;
      q("#robot-mode").textContent = hardware ? "Hardware unavailable" : "Simulation";
      q("#robot-controller").textContent = hardware ? "No adapter" : "Simulation";
      setHardwareDisabled(hardware);
      if (hardware) stopProgram("Hardware mode selected");
      event(hardware ? "Hardware adapter is not configured" : "Simulation controller activated", hardware ? "warning" : "info");
      updateDynamic(true);
    }

    function poseByName(name) { return state.poses.find((pose) => pose.name === name); }

    function stopMotion(reason = "Motion stopped") {
      if (state.motion) {
        const motion = state.motion;
        state.motion = null;
        state.target = {...state.joints};
        Object.keys(state.velocity).forEach((key) => { state.velocity[key] = 0; });
        motion.resolve?.({stopped:true});
      }
      state.lastCommand = reason;
      state.redraw = true;
    }

    function moveJoints(target, options = {}) {
      if (state.mode !== "simulation") return Promise.resolve({stopped:true});
      if (state.motion) stopMotion("Motion replaced");
      const normalized = {};
      asArray(CONFIG.joints).forEach((joint) => { normalized[joint.id] = clamp(Number(target[joint.id] ?? state.joints[joint.id]), joint.min_deg, joint.max_deg); });
      const maxDelta = Math.max(...Object.keys(normalized).map((key) => Math.abs(normalized[key] - state.joints[key])));
      const duration = Math.max(120, Number(options.durationMs) || (maxDelta / Math.max(8, state.speed)) * 1000);
      state.target = normalized;
      state.lastCommand = options.label || "Move joints";
      state.redraw = true;
      return new Promise((resolve) => {
        state.motion = {from:{...state.joints}, to:{...normalized}, duration, elapsed:0, resolve};
      });
    }

    function goToPose(name, options = {}) {
      const pose = poseByName(name);
      if (!pose) return Promise.resolve({stopped:true});
      state.lastCommand = `Move to ${name}`;
      return moveJoints(pose.joints, {...options, label:`Move to ${name}`});
    }

    function setGripper(value) {
      state.gripper = value === "close" ? "closed" : "open";
      state.lastCommand = `Gripper ${state.gripper}`;
      event(`Gripper ${state.gripper}`);
      updateDynamic(true);
    }

    async function waitWithControl(milliseconds, token) {
      let elapsed = 0;
      while (elapsed < milliseconds) {
        if (token !== state.executionToken) throw new Error("STOPPED");
        if (!state.paused) elapsed += 35;
        await waitTick();
      }
    }

    function executionProgram() {
      const program = parseProgram(ui.editor.value);
      const errors = validateProgram(program, state.poses);
      return {program, errors};
    }

    async function runProgram() {
      if (state.mode !== "simulation") { toast("Hardware adapter is not configured.", "error"); return; }
      const {program, errors} = executionProgram();
      showValidation(program, errors);
      if (errors.length) { toast("Fix the motion program before running it.", "error"); return; }
      stopProgram("Starting new program", false);
      const token = ++state.executionToken;
      state.paused = false;
      state.execution = {
        status:"running", index:-1, startedAt:performance.now(), elapsed:0,
        programName:program.name, message:`Starting ${program.name}`,
        steps:program.sequence.map((step) => ({label:stepLabel(step), status:"pending", time:"—"}))
      };
      q("#robot-active-program").textContent = program.name;
      q("#robot-program-state").textContent = "Running";
      event(`Program started: ${program.name}`, "info", {steps:program.sequence.length});
      updateExecution();
      try {
        for (let index = 0; index < program.sequence.length; index += 1) {
          if (token !== state.executionToken) throw new Error("STOPPED");
          const step = program.sequence[index];
          const stepStart = performance.now();
          state.execution.index = index;
          state.execution.steps[index].status = "running";
          state.execution.message = stepLabel(step);
          updateExecution();
          event(stepLabel(step));
          while (state.paused) { if (token !== state.executionToken) throw new Error("STOPPED"); await waitTick(); }
          if (step.pose) {
            const result = await goToPose(String(step.pose), {durationMs:Number(step.duration_ms) || undefined});
            if (result.stopped && token !== state.executionToken) throw new Error("STOPPED");
          } else if (step.joints) {
            const result = await moveJoints(step.joints, {durationMs:Number(step.duration_ms) || undefined, label:"Program joint target"});
            if (result.stopped && token !== state.executionToken) throw new Error("STOPPED");
          } else if (step.gripper) setGripper(String(step.gripper));
          else if (step.wait_ms !== undefined) await waitWithControl(Number(step.wait_ms), token);
          if (step.wait_ms !== undefined && (step.pose || step.joints || step.gripper)) await waitWithControl(Number(step.wait_ms), token);
          state.execution.steps[index].status = "completed";
          state.execution.steps[index].time = `${((performance.now() - stepStart) / 1000).toFixed(1)}s`;
          updateExecution();
        }
        if (token !== state.executionToken) throw new Error("STOPPED");
        state.execution.status = "completed";
        state.execution.message = `${program.name} completed`;
        state.execution.elapsed = performance.now() - state.execution.startedAt;
        q("#robot-program-state").textContent = "Completed";
        event(`Program completed: ${program.name}`);
        attachExecution(program);
        toast("Robotic motion program completed.");
      } catch (error) {
        if (error.message !== "STOPPED") {
          state.execution.status = "failed";
          state.execution.message = error.message || "Program failed";
          const active = state.execution.steps[state.execution.index];
          if (active) active.status = "failed";
          event(`Program failed: ${error.message}`, "error");
          toast("Motion program failed.", "error");
        }
      } finally {
        state.paused = false;
        updateExecution();
      }
    }

    function pauseProgram() {
      if (state.execution.status !== "running") return;
      state.paused = true;
      state.execution.status = "paused";
      state.execution.message = "Execution paused";
      q("#robot-program-state").textContent = "Paused";
      event("Program paused", "warning");
      updateExecution();
    }

    function resumeProgram() {
      if (state.execution.status !== "paused") return;
      state.paused = false;
      state.execution.status = "running";
      state.execution.message = state.execution.steps[state.execution.index]?.label || "Execution resumed";
      q("#robot-program-state").textContent = "Running";
      event("Program resumed");
      updateExecution();
    }

    function stopProgram(reason = "Program stopped", announce = true) {
      const wasActive = ["running","paused"].includes(state.execution.status);
      state.executionToken += 1;
      state.paused = false;
      stopMotion(reason);
      if (wasActive) {
        state.execution.status = "stopped";
        state.execution.message = reason;
        const active = state.execution.steps[state.execution.index];
        if (active && active.status === "running") active.status = "stopped";
        q("#robot-program-state").textContent = "Stopped";
        if (announce) event(reason, "warning");
      }
      updateExecution();
    }

    function attachExecution(program) {
      if (!q("#robot-attach-next").checked) return;
      const fk = forwardKinematics(state.joints);
      state.integration.last = {
        program:program.name,
        result:"Completed",
        duration:`${(state.execution.elapsed / 1000).toFixed(1)} s`,
        experiment:q("#robot-experiment").value,
        sample:q("#robot-sample").value,
        step:q("#robot-process-step").value,
        final:`[${fmt(fk.tool.x,0)}, ${fmt(fk.tool.y,0)}, ${fmt(fk.tool.z,0)}] mm`
      };
      renderIntegration();
      event(`Execution attached to ${state.integration.last.experiment}`);
    }

    function selectedProgram() { return state.programs.find((program) => program.id === state.selectedProgramId) || state.programs[0]; }

    function loadProgram(id) {
      const program = state.programs.find((item) => item.id === id);
      if (!program) return;
      state.selectedProgramId = id;
      ui.editor.value = programToYaml(program);
      showValidation(program, []);
      q("#robot-program-feedback").className = "robotics-program-feedback";
      q("#robot-program-feedback").textContent = "Loaded example. Validate before execution.";
      event(`Program loaded: ${program.name}`);
    }

    function showValidation(program, errors) {
      q("#robot-program-summary").innerHTML = asArray(program.sequence).map((step, index) => `<div class="robotics-program-step"><span>${index + 1}</span><div><strong>${esc(stepLabel(step))}</strong><small>${step.duration_ms ? `${step.duration_ms} ms motion` : step.wait_ms ? `${step.wait_ms} ms wait` : "Immediate action"}</small></div></div>`).join("") || '<div class="empty"><strong>No steps</strong><p>Add actions under sequence.</p></div>';
      const feedback = q("#robot-program-feedback");
      feedback.className = `robotics-program-feedback ${errors.length ? "is-error" : "is-valid"}`;
      feedback.textContent = errors.length ? errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} more)` : "") : `${program.sequence.length} steps valid · all pose and joint limits passed.`;
    }

    function validateEditor(showToast = true) {
      const program = parseProgram(ui.editor.value);
      const errors = validateProgram(program, state.poses);
      showValidation(program, errors);
      if (showToast) toast(errors.length ? `${errors.length} validation issue${errors.length === 1 ? "" : "s"}.` : "Motion program is valid.", errors.length ? "error" : "success");
      return !errors.length;
    }

    function renderPoses() {
      q("#robot-pose-count").textContent = state.poses.length;
      q("#robot-pose-rows").innerHTML = state.poses.map((pose) => `<tr data-pose="${esc(pose.name)}"><td><strong>${esc(pose.name)}</strong></td><td>${fmt(pose.joints.j1)}°</td><td>${fmt(pose.joints.j2)}°</td><td>${fmt(pose.joints.j3)}°</td><td><div class="cluster"><button class="btn btn-sm icon-btn" type="button" data-pose-go="${esc(pose.name)}" aria-label="Move to ${esc(pose.name)}">${icon("play")}</button><button class="btn btn-sm icon-btn" type="button" data-pose-edit="${esc(pose.name)}" aria-label="Edit ${esc(pose.name)}">${icon("edit")}</button><button class="btn btn-sm icon-btn" type="button" data-pose-copy="${esc(pose.name)}" aria-label="Duplicate ${esc(pose.name)}">${icon("copy")}</button><button class="btn btn-sm icon-btn" type="button" data-pose-delete="${esc(pose.name)}" aria-label="Delete ${esc(pose.name)}" ${pose.name === "HOME" ? "disabled" : ""}>${icon("trash")}</button></div></td></tr>`).join("");
      qa("[data-pose-go]").forEach((button) => button.addEventListener("click", () => { stopProgram("Manual pose command", false); goToPose(button.dataset.poseGo); event(`Moving to pose ${button.dataset.poseGo}`); }));
      qa("[data-pose-edit]").forEach((button) => button.addEventListener("click", () => { state.selectedPose = button.dataset.poseEdit; q("#robot-pose-name").value = button.dataset.poseEdit; toast("Move the joints, then save to update this pose."); }));
      qa("[data-pose-copy]").forEach((button) => button.addEventListener("click", () => { const source = poseByName(button.dataset.poseCopy); if (!source) return; let name = `${source.name}_COPY`; let counter = 2; while (poseByName(name)) name = `${source.name}_COPY_${counter++}`; state.poses.push({name,joints:{...source.joints}}); renderPoses(); event(`Pose duplicated: ${name}`); }));
      qa("[data-pose-delete]").forEach((button) => button.addEventListener("click", () => { state.poses = state.poses.filter((pose) => pose.name !== button.dataset.poseDelete); renderPoses(); event(`Pose deleted: ${button.dataset.poseDelete}`, "warning"); }));
    }

    function saveCurrentPose() {
      const input = q("#robot-pose-name");
      const name = input.value.trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "_");
      if (!name) { toast("Enter a pose name.", "error"); input.focus(); return; }
      const existing = poseByName(state.selectedPose || name);
      if (existing) { existing.name = name; existing.joints = {...state.joints}; event(`Pose updated: ${name}`); }
      else { state.poses.push({name,joints:{...state.joints}}); event(`Pose saved: ${name}`); }
      state.selectedPose = "";
      input.value = "";
      renderPoses();
      toast("Current robot configuration saved for this session.");
    }

    function currentPoseName() {
      const pose = state.poses.find((candidate) => asArray(CONFIG.joints).every((joint) => Math.abs(candidate.joints[joint.id] - state.joints[joint.id]) < 0.35));
      return pose?.name || "Custom";
    }

    function renderTelemetry() {
      q("#robot-telemetry-rows").innerHTML = asArray(CONFIG.joints).map((joint) => {
        const value = state.joints[joint.id];
        const valid = value >= joint.min_deg && value <= joint.max_deg;
        return `<tr><td>${joint.id.toUpperCase()}</td><td>${fmt(value)}°</td><td>${fmt(state.target[joint.id])}°</td><td>${fmt(state.velocity[joint.id])}°/s</td><td>${valid ? "Valid" : "Limit"}</td></tr>`;
      }).join("");
    }

    function renderLogs() {
      const log = q("#robot-event-log");
      if (!log) return;
      log.innerHTML = state.logs.map((record) => `<div class="robotics-event-row" data-level="${record.level}"><time>${record.time}</time><b>${record.level}</b><span>${esc(record.message)}</span></div>`).join("");
    }

    function renderIntegration() {
      const last = state.integration.last;
      q("#robot-integration-result").innerHTML = last ? `<div><span>Program</span><strong>${esc(last.program)}</strong></div><div><span>Result</span><strong>${esc(last.result)}</strong></div><div><span>Experiment</span><strong>${esc(last.experiment)}</strong></div><div><span>Sample</span><strong>${esc(last.sample)}</strong></div><div><span>Duration</span><strong>${esc(last.duration)}</strong></div><div><span>Evidence</span><strong>Execution log · ${esc(last.final)}</strong></div>` : '<div><span>Status</span><strong>No attached execution</strong></div><div><span>Evidence</span><strong>Execution log pending</strong></div>';
    }

    function elapsedText(milliseconds) {
      const seconds = Math.max(0, milliseconds) / 1000;
      const minutes = Math.floor(seconds / 60);
      return `${String(minutes).padStart(2,"0")}:${String(Math.floor(seconds % 60)).padStart(2,"0")}.${Math.floor((seconds % 1) * 10)}`;
    }

    function updateExecution() {
      const execution = state.execution;
      if (["running","paused"].includes(execution.status)) execution.elapsed = performance.now() - execution.startedAt;
      const completed = execution.steps.filter((step) => step.status === "completed").length;
      const progress = execution.steps.length ? (completed + (execution.status === "running" && execution.index >= 0 ? .45 : 0)) / execution.steps.length * 100 : 0;
      q("#robot-execution-badge").textContent = execution.status.charAt(0).toUpperCase() + execution.status.slice(1);
      q("#robot-execution-badge").className = `badge ${execution.status === "completed" ? "badge-success" : execution.status === "running" ? "badge-accent" : execution.status === "paused" ? "badge-warning" : execution.status === "failed" ? "badge-danger" : ""}`;
      q("#robot-execution-message").textContent = execution.message;
      q("#robot-execution-percent").textContent = `${Math.round(progress)}%`;
      q("#robot-progress-bar").style.width = `${progress}%`;
      q("#robot-elapsed").textContent = elapsedText(execution.elapsed);
      q("#robot-current-step").textContent = execution.index >= 0 ? `${execution.index + 1}/${execution.steps.length}` : "—";
      q("#robot-total-steps").textContent = execution.steps.length;
      q("#robot-timeline").innerHTML = execution.steps.map((step, index) => `<div class="robotics-timeline-row" data-status="${step.status}"><span>${index + 1}</span><strong>${esc(step.label)}</strong><b>${step.status}</b><em>${step.time}</em></div>`).join("") || '<div class="empty"><strong>No active timeline</strong><p>Validate and run a motion program.</p></div>';
      q("#robot-pause-program").disabled = execution.status !== "running";
      q("#robot-resume-program").disabled = execution.status !== "paused";
    }

    function themeColor(name, fallback) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function canvasSize(canvas) {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr,0,0,dpr,0,0);
      return {ctx,width,height};
    }

    function v3(x = 0, y = 0, z = 0) { return {x, y, z}; }
    function add3(a, b) { return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z}; }
    function sub3(a, b) { return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}; }
    function scale3(a, value) { return {x:a.x*value, y:a.y*value, z:a.z*value}; }
    function dot3(a, b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
    function cross3(a, b) { return {x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x}; }
    function length3(a) { return Math.hypot(a.x, a.y, a.z); }
    function normal3(a) { const length = length3(a) || 1; return scale3(a, 1 / length); }
    function mixColor(a, b, ratio) {
      const parse = (value) => {
        const match = String(value).trim().match(/^#([0-9a-f]{6})$/i);
        if (!match) return [120,140,160];
        return [0,2,4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16));
      };
      const aa=parse(a), bb=parse(b), r=clamp(ratio,0,1);
      return `rgb(${aa.map((value,index)=>Math.round(value+(bb[index]-value)*r)).join(",")})`;
    }

    function cameraProjection(width, height) {
      const target = state.camera.target || {x:175,y:0,z:190};
      const direction = {
        x: Math.cos(state.camera.pitch) * Math.cos(state.camera.yaw),
        y: Math.cos(state.camera.pitch) * Math.sin(state.camera.yaw),
        z: Math.sin(state.camera.pitch)
      };
      const forward = normal3(scale3(direction, -1));
      let right = normal3(cross3(forward, {x:0,y:0,z:1}));
      if (length3(right) < .1) right = {x:1,y:0,z:0};
      const up = normal3(cross3(right, forward));
      const robotSpan = Number(CONFIG.links?.link_1_mm || 260) + Number(CONFIG.links?.link_2_mm || 220) + Number(CONFIG.links?.tool_length_mm || 72);
      const fitScale = Math.min(width / Math.max(720, robotSpan * 1.55), height / Math.max(470, robotSpan * .95));
      const scale = fitScale * clamp(state.camera.zoom, .68, 1.65);
      const center = {x:width * .49, y:height * .55};
      const project = (point) => {
        const relative = sub3(point, target);
        return {
          x:center.x + dot3(relative, right) * scale,
          y:center.y - dot3(relative, up) * scale,
          depth:dot3(relative, forward),
          scale
        };
      };
      return {project, target, forward, right, up, scale, center};
    }

    function drawLine3D(ctx, project, a, b, color, width = 1, alpha = 1, dash = []) {
      const pa = project(a), pb = project(b);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.restore();
      return {pa, pb};
    }

    function drawArrow3D(ctx, project, origin, vector, color, label = "") {
      const end = add3(origin, vector);
      const {pa, pb} = drawLine3D(ctx, project, origin, end, color, 1.5, .9);
      const angle = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pb.x, pb.y);
      ctx.lineTo(pb.x - Math.cos(angle - .55) * 7, pb.y - Math.sin(angle - .55) * 7);
      ctx.lineTo(pb.x - Math.cos(angle + .55) * 7, pb.y - Math.sin(angle + .55) * 7);
      ctx.closePath();
      ctx.fill();
      if (label) {
        ctx.font = "600 10px system-ui";
        ctx.fillText(label, pb.x + 5, pb.y - 5);
      }
      ctx.restore();
    }

    function drawFloorGrid(ctx, projection, width, height, line, accent) {
      if (!state.overlays.grid) return;
      const {project} = projection;
      const extent = 600;
      for (let value = -extent; value <= extent; value += 100) {
        const axis = value === 0;
        drawLine3D(ctx, project, {x:value,y:-extent,z:0}, {x:value,y:extent,z:0}, axis ? accent : line, axis ? 1.1 : .8, axis ? .5 : .22);
        drawLine3D(ctx, project, {x:-extent,y:value,z:0}, {x:extent,y:value,z:0}, axis ? accent : line, axis ? 1.1 : .8, axis ? .5 : .22);
      }
      const fade = ctx.createLinearGradient(0, height * .45, 0, height);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0,.10)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, width, height);
    }

    function drawSoftShadow(ctx, project, points) {
      if (points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,.18)";
      ctx.lineWidth = 18;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.filter = "blur(5px)";
      ctx.beginPath();
      points.forEach((point, index) => {
        const p = project({...point, z:2});
        if (!index) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    function drawLink(ctx, project, a, b, colors, widthWorld = 30) {
      const pa = project(a), pb = project(b);
      const width = clamp(widthWorld * pa.scale, 12, 32);
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = width + 5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      const gradient = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
      gradient.addColorStop(0, colors.linkDark);
      gradient.addColorStop(.42, colors.link);
      gradient.addColorStop(.63, colors.linkLight);
      gradient.addColorStop(1, colors.linkDark);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = Math.max(1, width * .08);
      ctx.globalAlpha = .72;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y - width * .14);
      ctx.lineTo(pb.x, pb.y - width * .14);
      ctx.stroke();
      ctx.restore();
    }

    function drawJoint(ctx, project, point, label, angle, colors, sizeWorld = 22) {
      const p = project(point);
      const radius = clamp(sizeWorld * p.scale, 9, 21);
      ctx.save();
      ctx.fillStyle = colors.edge;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 3, 0, Math.PI * 2);
      ctx.fill();
      const gradient = ctx.createRadialGradient(p.x - radius * .35, p.y - radius * .35, 1, p.x, p.y, radius);
      gradient.addColorStop(0, colors.linkLight);
      gradient.addColorStop(.45, colors.link);
      gradient.addColorStop(1, colors.linkDark);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * .58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = colors.surface;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * .22, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "600 10px system-ui";
      ctx.fillStyle = colors.text;
      ctx.fillText(`${label}  ${fmt(angle,1)}°`, p.x + radius + 7, p.y - radius - 2);
      ctx.restore();
    }

    function drawBase(ctx, project, fk, colors) {
      const ground = project({x:0,y:0,z:0});
      const shoulder = project(fk.shoulder);
      const width = clamp(66 * ground.scale, 30, 64);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.16)";
      ctx.beginPath();
      ctx.ellipse(ground.x, ground.y + 8, width * .78, width * .22, 0, 0, Math.PI * 2);
      ctx.fill();
      const body = ctx.createLinearGradient(ground.x - width, 0, ground.x + width, 0);
      body.addColorStop(0, colors.linkDark);
      body.addColorStop(.5, colors.linkLight);
      body.addColorStop(1, colors.linkDark);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(ground.x - width * .48, shoulder.y, width * .96, ground.y - shoulder.y, 8);
      ctx.fill();
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = colors.link;
      ctx.beginPath();
      ctx.ellipse(ground.x, ground.y, width * .56, width * .20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.surface;
      ctx.beginPath();
      ctx.ellipse(shoulder.x, shoulder.y, width * .37, width * .13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "600 10px system-ui";
      ctx.fillStyle = colors.text;
      ctx.fillText(`J1  ${fmt(state.joints.j1,1)}°`, ground.x - width * .35, ground.y + width * .42);
      ctx.restore();
    }

    function drawGripper(ctx, project, wrist, tool, colors, isOpen) {
      drawLink(ctx, project, wrist, tool, colors, 14);
      const pW = project(wrist), pT = project(tool);
      const dx = pT.x - pW.x, dy = pT.y - pW.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length, uy = dy / length;
      const nx = -uy, ny = ux;
      const spread = isOpen ? 9 : 4;
      const finger = 20;
      ctx.save();
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(pT.x + nx * spread * side, pT.y + ny * spread * side);
        ctx.lineTo(pT.x + nx * spread * side + ux * finger, pT.y + ny * spread * side + uy * finger);
        ctx.stroke();
      });
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(pT.x + nx * spread * side, pT.y + ny * spread * side);
        ctx.lineTo(pT.x + nx * spread * side + ux * finger, pT.y + ny * spread * side + uy * finger);
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawFrame(ctx, project, origin, size, colors, labels = false) {
      drawArrow3D(ctx, project, origin, {x:size,y:0,z:0}, colors.x, labels ? "X" : "");
      drawArrow3D(ctx, project, origin, {x:0,y:size,z:0}, colors.y, labels ? "Y" : "");
      drawArrow3D(ctx, project, origin, {x:0,y:0,z:size}, colors.z, labels ? "Z" : "");
    }

    function drawTarget(ctx, project, targetPoint, color) {
      const p = project(targetPoint);
      const ground = project({...targetPoint, z:0});
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = .8;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ground.x, ground.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - 12, p.y);
      ctx.lineTo(p.x + 12, p.y);
      ctx.moveTo(p.x, p.y - 12);
      ctx.lineTo(p.x, p.y + 12);
      ctx.stroke();
      ctx.restore();
    }

    function drawScene() {
      const {ctx,width,height} = canvasSize(ui.scene);
      const projection = cameraProjection(width,height);
      const surface = themeColor("--surface", "#ffffff");
      const surface2 = themeColor("--surface2", "#f5f7fa");
      const surface3 = themeColor("--surface3", "#e9eef4");
      const text = themeColor("--text", "#17202b");
      const muted = themeColor("--muted", "#6b7787");
      const line = themeColor("--line", "#d8e0e8");
      const accent = themeColor("--accent", "#3b82f6");
      const warning = themeColor("--warning", "#d78b20");
      const danger = themeColor("--danger", "#d9535f");
      const colors = {
        surface,
        text,
        accent,
        edge:mixColor(text, "#000000", .34),
        link:mixColor(surface3, text, .18),
        linkLight:mixColor(surface2, "#ffffff", .45),
        linkDark:mixColor(surface3, text, .38),
        highlight:"rgba(255,255,255,.58)",
        x:danger,
        y:themeColor("--success", "#2aa66f"),
        z:accent
      };
      const background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, mixColor(surface2, accent, .025));
      background.addColorStop(1, surface);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      drawFloorGrid(ctx, projection, width, height, line, accent);

      const fk = forwardKinematics(state.joints);
      const targetFk = forwardKinematics(state.target);
      drawSoftShadow(ctx, projection.project, [fk.shoulder, fk.elbow, fk.wrist, fk.tool]);

      if (state.overlays.trajectory && state.trajectory.length > 1) {
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.globalAlpha = .65;
        ctx.beginPath();
        state.trajectory.slice(-90).forEach((point, index) => {
          const p = projection.project(point);
          if (!index) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
      }
      if (state.overlays.target) drawTarget(ctx, projection.project, targetFk.tool, warning);

      drawBase(ctx, projection.project, fk, colors);
      drawLink(ctx, projection.project, fk.shoulder, fk.elbow, colors, 31);
      drawLink(ctx, projection.project, fk.elbow, fk.wrist, colors, 27);
      drawJoint(ctx, projection.project, fk.shoulder, "J2", state.joints.j2, colors, 23);
      drawJoint(ctx, projection.project, fk.elbow, "J3", state.joints.j3, colors, 21);
      drawGripper(ctx, projection.project, fk.wrist, fk.tool, colors, state.gripper === "open");

      if (state.overlays.frames) {
        drawFrame(ctx, projection.project, {x:-105,y:-105,z:2}, 55, colors, true);
        drawFrame(ctx, projection.project, fk.tool, 42, colors, false);
      }

      const toolP = projection.project(fk.tool);
      ctx.save();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(toolP.x, toolP.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "600 10px system-ui";
      ctx.fillStyle = muted;
      ctx.fillText("TCP", toolP.x + 8, toolP.y - 8);
      ctx.restore();

      q("#robot-hud-tcp").textContent = `${fmt(fk.tool.x,0)} · ${fmt(fk.tool.y,0)} · ${fmt(fk.tool.z,0)} mm`;
      const status = q("#robot-hud-motion");
      status.textContent = state.motion ? "MOVING" : state.execution.status === "paused" ? "PAUSED" : "READY";
      status.className = `badge ${state.motion ? "badge-accent" : state.execution.status === "paused" ? "badge-warning" : "badge-success"}`;
    }

    function drawConfigurationSpace() {
      const {ctx,width,height} = canvasSize(ui.config);
      const [xId,yId] = q("#robot-config-plane").value.split(",");
      const joints = Object.fromEntries(asArray(CONFIG.joints).map((joint)=>[joint.id,joint]));
      const xJoint=joints[xId], yJoint=joints[yId];
      const surface=themeColor("--surface2","#18202b"), line=themeColor("--line","#394554"), text=themeColor("--muted","#9ba9b8"), accent=themeColor("--accent","#3b82f6"), success=themeColor("--success","#22c55e"), warning=themeColor("--warning","#e7a83e");
      ctx.fillStyle=surface;ctx.fillRect(0,0,width,height);
      const pad={l:40,r:16,t:14,b:30}; const plot={x:pad.l,y:pad.t,w:width-pad.l-pad.r,h:height-pad.t-pad.b};
      const sx=(value)=>plot.x+(value-xJoint.min_deg)/(xJoint.max_deg-xJoint.min_deg)*plot.w;
      const sy=(value)=>plot.y+plot.h-(value-yJoint.min_deg)/(yJoint.max_deg-yJoint.min_deg)*plot.h;
      ctx.fillStyle=warning;ctx.globalAlpha=.12;ctx.beginPath();ctx.moveTo(sx(xJoint.min_deg),sy(yJoint.max_deg));ctx.lineTo(sx(xJoint.min_deg+(xJoint.max_deg-xJoint.min_deg)*.24),sy(yJoint.max_deg));ctx.lineTo(sx(xJoint.min_deg),sy(yJoint.max_deg-(yJoint.max_deg-yJoint.min_deg)*.33));ctx.closePath();ctx.fill();ctx.globalAlpha=1;
      ctx.strokeStyle=line;ctx.lineWidth=1;ctx.font="8px system-ui";ctx.fillStyle=text;
      for(let i=0;i<=4;i+=1){const xv=xJoint.min_deg+(xJoint.max_deg-xJoint.min_deg)*i/4;const yv=yJoint.min_deg+(yJoint.max_deg-yJoint.min_deg)*i/4;ctx.beginPath();ctx.moveTo(sx(xv),plot.y);ctx.lineTo(sx(xv),plot.y+plot.h);ctx.stroke();ctx.beginPath();ctx.moveTo(plot.x,sy(yv));ctx.lineTo(plot.x+plot.w,sy(yv));ctx.stroke();ctx.fillText(`${Math.round(xv)}°`,sx(xv)-9,height-10);ctx.fillText(`${Math.round(yv)}°`,4,sy(yv)+3);}
      if(state.jointTrajectory.length>1){ctx.save();ctx.strokeStyle=accent;ctx.globalAlpha=.68;ctx.lineWidth=1.5;ctx.shadowColor=accent;ctx.shadowBlur=5;ctx.beginPath();state.jointTrajectory.slice(-80).forEach((values,index)=>{const x=values[xId],y=values[yId];if(index===0)ctx.moveTo(sx(x),sy(y));else ctx.lineTo(sx(x),sy(y));});ctx.stroke();ctx.restore();}
      [[state.joints,accent,5],[state.target,success,4]].forEach(([values,color,radius])=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(sx(values[xId]),sy(values[yId]),radius,0,Math.PI*2);ctx.fill();});
      ctx.fillStyle=text;ctx.font="700 9px system-ui";ctx.fillText(`${xId.toUpperCase()} (deg)`,plot.x+plot.w/2-20,height-2);ctx.save();ctx.translate(10,plot.y+plot.h/2+18);ctx.rotate(-Math.PI/2);ctx.fillText(`${yId.toUpperCase()} (deg)`,0,0);ctx.restore();
    }

    function updateDynamic(force = false) {
      const fk = forwardKinematics(state.joints);
      asArray(CONFIG.joints).forEach((joint) => {
        const input=q(`#robot-${joint.id}`); if(input && document.activeElement !== input) input.value=state.target[joint.id];
        const currentOutput = q(`[data-current="${joint.id}"]`);
        if (currentOutput) currentOutput.textContent=`${fmt(state.joints[joint.id])}°`;
      });
      q("#robot-x").textContent=`X ${fmt(fk.tool.x)} mm`;q("#robot-y").textContent=`Y ${fmt(fk.tool.y)} mm`;q("#robot-z").textContent=`Z ${fmt(fk.tool.z)} mm`;q("#robot-distance").textContent=`${fmt(fk.distance)} mm`;
      q("#robot-direction").textContent=`${fmt(fk.direction.x,2)} / ${fmt(fk.direction.y,2)} / ${fmt(fk.direction.z,2)}`;
      q("#robot-position-vector").textContent=`[${fmt(fk.tool.x,0)}, ${fmt(fk.tool.y,0)}, ${fmt(fk.tool.z,0)}] mm`;
      q("#robot-tool-vector").textContent=`[${fmt(fk.direction.x,2)}, ${fmt(fk.direction.y,2)}, ${fmt(fk.direction.z,2)}]`;
      q("#robot-joint-vector").textContent=`[${fmt(state.joints.j1)}°, ${fmt(state.joints.j2)}°, ${fmt(state.joints.j3)}°]`;
      q("#robot-last-command").textContent=state.lastCommand;
      const valid=asArray(CONFIG.joints).every((joint)=>state.joints[joint.id]>=joint.min_deg&&state.joints[joint.id]<=joint.max_deg);
      q("#robot-validity").textContent=valid?"Valid":"Limit violation";q("#robot-end-status").textContent=valid?"Within limits":"Outside limits";q("#robot-end-status").className=`badge ${valid?"badge-success":"badge-danger"}`;
      q("#robot-state").textContent=state.motion?"Moving":state.execution.status==="paused"?"Paused":state.mode==="hardware"?"Unavailable":"Ready";
      q("#robot-current-pose").textContent=currentPoseName();q("#robot-gripper-state").textContent=state.gripper.charAt(0).toUpperCase()+state.gripper.slice(1);
      const grip=q("#robot-gripper");grip.classList.toggle("is-open",state.gripper==="open");grip.querySelector("span").textContent=`Gripper ${state.gripper}`;
      renderTelemetry();
      if(force){drawScene();drawConfigurationSpace();}
    }

    let lastFrame=performance.now(), lastUi=0;
    function animationFrame(time) {
      if(state.destroyed) return;
      const dt=Math.min(50,time-lastFrame);lastFrame=time;
      if(state.motion && !state.paused){
        const motion=state.motion;motion.elapsed+=dt;const t=clamp(motion.elapsed/motion.duration,0,1);const eased=t*t*t*(t*(t*6-15)+10);
        asArray(CONFIG.joints).forEach((joint)=>{const previous=state.joints[joint.id];state.joints[joint.id]=motion.from[joint.id]+(motion.to[joint.id]-motion.from[joint.id])*eased;state.velocity[joint.id]=(state.joints[joint.id]-previous)/(dt/1000||1);});
        const tool=forwardKinematics(state.joints).tool;const last=state.trajectory[state.trajectory.length-1];if(!last||Math.hypot(tool.x-last.x,tool.y-last.y,tool.z-last.z)>4){state.trajectory.push({...tool});state.trajectory=state.trajectory.slice(-120);state.jointTrajectory.push({...state.joints});state.jointTrajectory=state.jointTrajectory.slice(-140);}
        state.redraw=true;
        if(t>=1){const finished=state.motion;state.motion=null;Object.keys(state.velocity).forEach((key)=>{state.velocity[key]=0;});finished.resolve?.({stopped:false});state.redraw=true;}
      }
      if(state.redraw){drawScene();drawConfigurationSpace();state.redraw=false;}
      if(time-lastUi>90){updateDynamic();updateExecution();lastUi=time;}
      requestAnimationFrame(animationFrame);
    }

    function resetView() {
      state.camera={yaw:-0.72,pitch:0.42,zoom:1.0,target:{x:175,y:0,z:190}};
      state.redraw=true;
    }

    let dragging=false,lastPointer={x:0,y:0};
    ui.scene.addEventListener("pointerdown",(event)=>{dragging=true;lastPointer={x:event.clientX,y:event.clientY};ui.scene.setPointerCapture(event.pointerId);});
    ui.scene.addEventListener("pointermove",(event)=>{if(!dragging)return;state.camera.yaw+=(event.clientX-lastPointer.x)*.007;state.camera.pitch=clamp(state.camera.pitch+(event.clientY-lastPointer.y)*.006,-.2,1.25);lastPointer={x:event.clientX,y:event.clientY};state.redraw=true;});
    ui.scene.addEventListener("pointerup",()=>{dragging=false;});ui.scene.addEventListener("pointercancel",()=>{dragging=false;});
    ui.scene.addEventListener("wheel",(event)=>{event.preventDefault();state.camera.zoom=clamp(state.camera.zoom*(event.deltaY>0?.9:1.1),.55,1.8);state.redraw=true;},{passive:false});

    qa("[data-mode]").forEach((button)=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
    qa("[data-overlay]").forEach((input)=>input.addEventListener("change",()=>{state.overlays[input.dataset.overlay]=input.checked;state.redraw=true;}));
    asArray(CONFIG.joints).forEach((joint)=>{
      const input=q(`#robot-${joint.id}`);
      input.addEventListener("input",()=>{
        stopProgram("Manual joint command",false);
        stopMotion(`Manual ${joint.id.toUpperCase()} positioning`);
        const value=clamp(Number(input.value),joint.min_deg,joint.max_deg);
        state.joints[joint.id]=value;
        state.target[joint.id]=value;
        state.velocity[joint.id]=0;
        state.lastCommand=`Set ${joint.id.toUpperCase()} to ${fmt(value,1)}°`;
        const tool=forwardKinematics(state.joints).tool;
        const last=state.trajectory[state.trajectory.length-1];
        if(!last||Math.hypot(tool.x-last.x,tool.y-last.y,tool.z-last.z)>3){state.trajectory.push({...tool});state.trajectory=state.trajectory.slice(-90);state.jointTrajectory.push({...state.joints});state.jointTrajectory=state.jointTrajectory.slice(-120);}
        state.redraw=true;
        updateDynamic(true);
      });
    });
    qa("[data-jog]").forEach((button)=>button.addEventListener("click",()=>{
      stopProgram("Manual jog command",false);
      const joint=asArray(CONFIG.joints).find((item)=>item.id===button.dataset.jog);
      const value=clamp(state.target[joint.id]+Number(button.dataset.delta),joint.min_deg,joint.max_deg);
      moveJoints({...state.target,[joint.id]:value},{durationMs:260,label:`Jog ${joint.id.toUpperCase()}`});
    }));
    q("#robot-speed").addEventListener("input",(event)=>{state.speed=Number(event.target.value);q("#robot-speed-value").textContent=`${state.speed}°/s`;});
    q("#robot-home").addEventListener("click",()=>{stopProgram("Home command",false);goToPose("HOME");event("Moving to HOME");});
    q("#robot-stop").addEventListener("click",()=>{stopProgram("Simulation stopped by operator");toast("Simulation stopped.","error");});
    q("#robot-view-reset").addEventListener("click",resetView);
    q("#robot-config-plane").addEventListener("change",()=>{state.redraw=true;});
    q("#robot-save-pose").addEventListener("click",saveCurrentPose);
    q("#robot-program-select").addEventListener("change",(event)=>loadProgram(event.target.value));
    q("#robot-new-program").addEventListener("click",()=>{ui.editor.value="name: new_motion_program\nspeed: 0.50\n\nsequence:\n  - pose: HOME\n    wait_ms: 300\n";showValidation(parseProgram(ui.editor.value),[]);q("#robot-program-feedback").className="robotics-program-feedback";q("#robot-program-feedback").textContent="New session-only draft.";});
    q("#robot-validate-program").addEventListener("click",()=>validateEditor(true));
    q("#robot-run-program").addEventListener("click",runProgram);q("#robot-run-demo").addEventListener("click",()=>{loadProgram(state.programs[0].id);runProgram();});
    q("#robot-pause-program").addEventListener("click",pauseProgram);q("#robot-resume-program").addEventListener("click",resumeProgram);q("#robot-stop-program").addEventListener("click",()=>stopProgram("Program stopped by operator"));
    q("#robot-import-program").addEventListener("click",()=>q("#robot-import-file").click());
    q("#robot-import-file").addEventListener("change",(event)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{ui.editor.value=String(reader.result||"");validateEditor(false);event.target.value="";event(`Program imported: ${file.name}`);};reader.onerror=()=>toast("The motion program could not be read.","error");reader.readAsText(file);});
    q("#robot-download-program").addEventListener("click",()=>{const blob=new Blob([ui.editor.value],{type:"application/yaml"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`${parseProgram(ui.editor.value).name||"robot-motion"}.yaml`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);event("Motion program downloaded");});
    q("#robot-set-target").addEventListener("click",()=>{state.target={...state.joints};state.lastCommand="Current TCP stored as visual target";state.redraw=true;toast("Current end-effector point set as the visual target.");});
    window.addEventListener("resize",()=>{state.redraw=true;});
    const observer=new MutationObserver(()=>{state.redraw=true;});observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme","data-palette","data-density"]});

    loadProgram(selectedProgram()?.id);
    renderPoses();renderLogs();renderIntegration();updateExecution();updateDynamic(true);
    event("Robotics simulation ready", "info", {robot:CONFIG.id,joints:asArray(CONFIG.joints).length});
    requestAnimationFrame(animationFrame);
  }

  window.LabFlowRobotics = {renderBase};
})();
