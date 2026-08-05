# Robotics capability

Robotics is a top-level LabFlow capability, parallel to AI & Models. It demonstrates how a laboratory workflow can simulate, configure and document robotic operations without making robotics necessary for ordinary experiments.

## Scope of the proof of concept

The checked-in page controls a configurable three-joint robot arm through a deterministic local simulation. It performs no network request, has no browser persistence and does not imply a physical connection.

Implemented capabilities:

- perspective canvas renderer with orbit, zoom and ISO/front/side/top camera presets;
- shaded metallic links, articulated joint hubs, gripper geometry, floor shadows and depth-aware scaling;
- workspace guides, coordinate frames, TCP trail, pose markers, selected-program path and target ghosting;
- direct kinematics for J1 base rotation, J2 shoulder and J3 elbow;
- joint sliders, jog actions, Home, Reset and Stop;
- end-effector position, direction vectors, frames, target and recent trajectory;
- selectable two-dimensional configuration-space planes with the real simulated joint-history trace;
- session-only saved poses;
- YAML-like motion programs with import, download, validation and execution;
- pause, resume and stop behavior with an execution timeline;
- compact state, telemetry and event logs;
- demonstration attachment of a completed run to an existing LabFlow project and sample.

## Canonical configuration

`robotics/robot-arm-01.yaml` defines the arm dimensions, joint limits, home values, demonstration poses, motion programs and initial experiment link. `tools/build_robotics_bundle.py` produces the request-free browser snapshot in `assets/js/robotics-bundle.js`.

The current model is intentionally specific and small. It is not a general industrial robot schema.

## Simulation and hardware boundary

Simulation is the only operational controller in the POC. Selecting Hardware clearly reports that no adapter is configured and disables movement controls. A future hardware controller can implement the same small command boundary without changing the visual page:

- read state;
- move joints;
- move to a named pose;
- run, pause, resume and stop a program;
- report result and evidence.

No ROS, MoveIt, external physics engine, remote telemetry or automatic hardware discovery is included.

## Experiment integration

Robotics remains a global platform capability. A successful motion run can be associated with an existing workspace project, sample and process step. The POC records the program name, completion state, duration, final tool position and execution log as demonstration evidence.

A future backend should store a versioned program snapshot and controller result rather than linking mutable pose definitions directly.

## Future extensions

Potential extensions include a real controller adapter, gripper feedback, calibrated dimensions, inverse kinematics, collision checks, trajectory planning, URDF import and ROS integration. These are explicitly outside the current static POC.
