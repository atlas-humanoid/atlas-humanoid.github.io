import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Easing, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

// Conceptual positions, never a reconstruction of measured trajectories.
// Times follow the existing, 3x-speed stairs_run_3x.mp4 (21 seconds).
const ATTEMPTS = [
  {start: 3.4, land: 5.5, update: 8.0, end: {x: 235, y: 285}},
  {start: 8.7, land: 10.7, update: 13.0, end: {x: 326, y: 313}},
  {start: 13.7, land: 16.2, update: 21, end: {x: 374, y: 328}},
] as const;
const TARGET = {x: 374, y: 328};
const BLUE = '#2464b5';
const INK = '#24272d';
const MUTED = '#777d87';
const BG = '#f5f5f7';
const ERROR = '#b96c61';
const ease = Easing.bezier(0.22, 0.68, 0.12, 1);
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

const Gripper: React.FC<{x: number; y: number; close: number; opacity?: number; ghost?: boolean}> = ({x, y, close, opacity = 1, ghost = false}) => {
  const spread = mix(28, 18, close);
  return <g transform={`translate(${x} ${y})`} opacity={opacity}>
    {!ghost && <ellipse cx="0" cy="6" rx="47" ry="11" fill="#24272d" opacity="0.055" />}
    <rect x="-13" y="-106" width="26" height="34" rx="8" fill={ghost ? '#d4d7dd' : '#a0a6ae'} />
    <rect x="-40" y="-79" width="80" height="46" rx="14" fill={ghost ? '#e4e6ea' : 'url(#metal)'} stroke={ghost ? '#c6cbd3' : '#777e89'} strokeWidth="1.5" />
    <path d="M -27 -68 H 27" stroke="#ffffff" strokeWidth="2" opacity={ghost ? 0.3 : 0.75} strokeLinecap="round" />
    <circle cx="-22" cy="-51" r="3" fill={ghost ? '#c1c6ce' : '#737b86'} />
    <circle cx="22" cy="-51" r="3" fill={ghost ? '#c1c6ce' : '#737b86'} />
    <path d={`M ${-spread} -33 V -5 Q ${-spread} 6 ${-spread + 10} 6 H -10 M ${spread} -33 V -5 Q ${spread} 6 ${spread - 10} 6 H 10`} fill="none" stroke={ghost ? '#bfc5ce' : '#444c58'} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    {!ghost && <circle cx="0" cy="0" r="3.5" fill={INK} />}
  </g>;
};

const Target: React.FC<{success: number; t: number}> = ({success, t}) => {
  const pulse = Math.max(0, 1 - (t - 16.2) / 1.4);
  return <g transform={`translate(${TARGET.x} ${TARGET.y})`}>
    <ellipse cx="0" cy="2" rx="66" ry="32" fill="#e7eef8" />
    <circle r="28" fill="#fff" stroke={BLUE} strokeWidth="2" />
    <path d="M -8 -10 L 5 -13 L 14 -4 L 10 10 L -3 14 L -13 4 Z" fill="#e5edf9" stroke="#6488b8" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M -8 -10 L -1 0 L 10 10 M -1 0 L 14 -4 M -1 0 L -3 14" fill="none" stroke="#8fa7c8" strokeWidth="1.3" />
    {[-1, 1].map(k => <g key={k} stroke={BLUE} strokeWidth="2" opacity="0.55"><path d={`M ${k * 35} 0 H ${k * 42}`} /><path d={`M 0 ${k * 35} V ${k * 42}`} /></g>)}
    {success > 0 && <circle r={38 + (1 - pulse) * 32} fill="none" stroke={BLUE} strokeWidth="2" opacity={pulse * 0.4} />}
    <text x="0" y="83" textAnchor="middle" fill={BLUE} fontSize="23" fontWeight="500">Grasp target</text>
    <path d="M 0 45 V 57" stroke="#b7c9e2" strokeWidth="1.5" />
  </g>;
};

const Attempt: React.FC<{index: number; t: number; preview?: boolean}> = ({index, t, preview = false}) => {
  const attempt = ATTEMPTS[index];
  const movement = ramp(t, attempt.start, attempt.land);
  const landed = ramp(t, attempt.land, attempt.land + 0.35);
  const started = t >= attempt.start;
  const done = t >= attempt.land;
  const success = index === 2 ? landed : 0;
  const x = mix(160, attempt.end.x, movement);
  const y = mix(246, attempt.end.y, movement);
  const active = (index === 0 && t < 8.4) || (index === 1 && t >= 8.4 && t < 13.4) || (index === 2 && t >= 13.4);
  const previous = index > 0 ? ATTEMPTS[index - 1].end : null;
  const showGhost = previous && t >= attempt.start ? 0.26 * (1 - landed * 0.6) : 0;
  const result = index === 2 ? 'Grasp.' : 'Miss.';
  const cue = index === 0 ? 'Observe the miss.' : index === 1 ? 'Use the updated policy.' : 'Reach the target.';
  const bodyOpacity = started || active || preview ? 1 : 0.35;
  return <g>
    <text x="40" y="50" fill={active ? BLUE : MUTED} fontSize="19" fontWeight="500" letterSpacing="2.2">ATTEMPT {String(index + 1).padStart(2, '0')}</text>
    <circle cx="518" cy="43" r="5" fill={active ? BLUE : '#d1d5dc'} />
    <text x="40" y="105" fill={INK} fontSize="38" fontWeight="600" letterSpacing="-1.1" opacity={1 - landed}>{index === 0 ? 'First reach.' : 'Next reach.'}</text>
    <text x="40" y="105" fill={index === 2 ? BLUE : INK} fontSize="38" fontWeight="600" letterSpacing="-1.1" opacity={landed}>{result}</text>
    <g opacity={bodyOpacity}>
      <Target success={success} t={t} />
      {previous && <Gripper x={previous.x} y={previous.y} close={0} opacity={showGhost} ghost />}
      {index < 2 && <g opacity={landed}>
        <path d={`M ${attempt.end.x} ${attempt.end.y} L ${TARGET.x} ${TARGET.y}`} fill="none" stroke={ERROR} strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" />
        <circle cx={attempt.end.x} cy={attempt.end.y} r="7" fill="none" stroke={ERROR} strokeWidth="1.6" />
        <text x={index === 0 ? 208 : 258} y={index === 0 ? 355 : 385} textAnchor="middle" fill={ERROR} fontSize="22" fontWeight="500">{index === 0 ? 'Missed by this much' : 'Remaining gap'}</text>
      </g>}
      <Gripper x={x} y={y} close={index === 2 ? ramp(t, 16.2, 16.7) : 0} />
      {!started && <text x="160" y="285" textAnchor="middle" fill={MUTED} fontSize="20">Gripper</text>}
      {success > 0 && <g transform="translate(420 277)" opacity={success}>
        <circle r="16" fill={BLUE} />
        <path d="M -7 0 L -2 5 L 8 -6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
    </g>
    <text x="40" y="490" fill={done || active ? INK : MUTED} fontSize="27" fontWeight="500" letterSpacing="-0.5">{cue}</text>
    <text x="40" y="528" fill={MUTED} fontSize="21">{index === 0 ? 'Execution error becomes experience.' : index === 1 ? 'The next reach uses what was learned.' : 'A successful grasp in this run.'}</text>
  </g>;
};

const Update: React.FC<{t: number; start: number; x: number}> = ({t, start, x}) => {
  const p = ramp(t, start, start + 0.35);
  const wave = ramp(t, start, start + 1.4);
  return <g transform={`translate(${x} 285)`} opacity={mix(0.25, 1, p)}>
    <circle r="28" fill={p > 0 ? '#e5edf9' : '#e9eaee'} />
    <g transform={`rotate(${wave * 180})`} fill="none" stroke={BLUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M -10 -4 A 11 11 0 0 1 10 -5 M 10 -12 V -5 H 3 M 10 4 A 11 11 0 0 1 -10 5 M -10 12 V 5 H -3" />
    </g>
    <text x="0" y="57" textAnchor="middle" fill={BLUE} fontSize="20" fontWeight="500">Learn</text>
    <path d="M -26 88 H 26 M 18 80 L 26 88 L 18 96" fill="none" stroke="#8eabcF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </g>;
};

export const LearningLoop: React.FC<{mobile: boolean}> = ({mobile}) => {
  const [fontHandle] = useState(() => delayRender('Load the bundled Geist font'));
  useEffect(() => {
    Promise.all([400, 500, 600].map(weight => document.fonts.load(`${weight} 24px Geist`)))
      .then(() => continueRender(fontHandle));
  }, [fontHandle]);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const active = t < 8.4 ? 0 : t < 13.4 ? 1 : 2;
  const updating = (t >= 8 && t < 8.8) || (t >= 13 && t < 13.8);
  return <AbsoluteFill style={{background: BG, fontFamily: 'Geist, sans-serif'}}>
    <svg viewBox={mobile ? '0 0 960 900' : '0 0 1920 640'} width="100%" height="100%">
      <defs>
        <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f0f1f4" /><stop offset="0.48" stopColor="#d1d5dc" /><stop offset="1" stopColor="#a5acb7" /></linearGradient>
      </defs>
      {mobile ? <>
        <g transform="translate(70 56)">
          {[0, 1, 2].map(i => <g key={i} transform={`translate(${i * 280} 0)`}>
            <rect width="260" height="5" rx="2.5" fill={i <= active ? BLUE : '#dfe2e7'} />
            <text x="0" y="43" fill={i === active ? BLUE : MUTED} fontSize="23" fontWeight={i === active ? '600' : '400'}>{['01 · First reach', '02 · Next reach', '03 · Next reach'][i]}</text>
          </g>)}
        </g>
        <g transform="translate(104 129) scale(1.32)"><Attempt index={active} t={t} /></g>
        <g transform="translate(70 870)">
          <circle cx="12" cy="-10" r="7" fill={updating ? BLUE : '#bac4d2'} />
          <text x="35" y="0" fill={updating ? BLUE : MUTED} fontSize="25" fontWeight="500">{updating ? 'Learning from the previous attempt…' : 'Observe → Learn → Reach again'}</text>
        </g>
      </> : <>
        {[0, 1, 2].map(i => <g key={i} transform={`translate(${24 + i * 640} 20)`}><Attempt index={i} t={t} /></g>)}
        <Update t={t} start={8} x={638} />
        <Update t={t} start={13} x={1278} />
        <path d="M 64 585 H 1856" stroke="#dfe2e7" strokeWidth="1" />
        <text x="64" y="622" fill={MUTED} fontSize="19">The target stays fixed in this illustration.</text>
        <text x="1856" y="622" textAnchor="end" fill={BLUE} fontSize="19" fontWeight="500">Experience → policy update → next reach</text>
      </>}
    </svg>
  </AbsoluteFill>;
};
