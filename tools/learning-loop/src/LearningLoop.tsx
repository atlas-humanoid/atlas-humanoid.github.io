import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Easing, Freeze, Img, OffthreadVideo, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// One original 21-second recording, already sped up 3x. Source frames are
// presented in order; completed attempts retain their last source frame.
// Diagram positions below are conceptual, not tracked robot measurements.
const ATTEMPTS = [
  {slot: 0, start: 3.4, land: 5.5, update: 8.0, lastFrame: 251, end: {x: 232, y: 156}},
  {slot: 8.4, start: 8.7, land: 10.7, update: 13.0, lastFrame: 401, end: {x: 325, y: 178}},
  {slot: 13.4, start: 13.7, land: 16.2, update: 21, lastFrame: 629, end: {x: 380, y: 188}},
] as const;
const TARGET = {x: 380, y: 188};
const BLUE = '#2464b5';
const INK = '#24272d';
const MUTED = '#858a93';
const BG = '#f5f5f7';
const ERROR = '#b96c61';
const ease = Easing.bezier(0.22, 0.68, 0.12, 1);
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const activeAttempt = (t: number) => t < 8.4 ? 0 : t < 13.4 ? 1 : 2;

const Gripper: React.FC<{x: number; y: number; close: number}> = ({x, y, close}) => {
  const spread = mix(28, 18, close);
  return <g transform={'translate(' + x + ' ' + y + ')'}>
    <ellipse cx="0" cy="6" rx="47" ry="11" fill="#24272d" opacity="0.055" />
    <rect x="-13" y="-106" width="26" height="34" rx="8" fill="#a0a6ae" />
    <rect x="-40" y="-79" width="80" height="46" rx="14" fill="url(#metal)" stroke="#777e89" strokeWidth="1.5" />
    <path d="M -27 -68 H 27" stroke="#fff" strokeWidth="2" opacity="0.75" strokeLinecap="round" />
    <circle cx="-22" cy="-51" r="3" fill="#737b86" />
    <circle cx="22" cy="-51" r="3" fill="#737b86" />
    <path d={'M ' + -spread + ' -33 V -5 Q ' + -spread + ' 6 ' + (-spread + 10) + ' 6 H -10 M ' + spread + ' -33 V -5 Q ' + spread + ' 6 ' + (spread - 10) + ' 6 H 10'} fill="none" stroke="#444c58" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    <circle r="3.5" fill={INK} />
  </g>;
};

const Reach: React.FC<{index: number; t: number}> = ({index, t}) => {
  const attempt = ATTEMPTS[index];
  const movement = ramp(t, attempt.start, attempt.land);
  const landed = ramp(t, attempt.land, attempt.land + 0.35);
  const started = t >= attempt.slot;
  const x = mix(148, attempt.end.x, movement);
  const y = mix(148, attempt.end.y, movement);
  const success = index === 2 ? landed : 0;
  return <svg viewBox="0 0 568 280" width="100%" height="100%" style={{overflow: 'visible'}}>
    <defs><linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f0f1f4" /><stop offset="0.48" stopColor="#d1d5dc" /><stop offset="1" stopColor="#a5acb7" /></linearGradient></defs>
    <g opacity={started ? 1 : 0.3}>
      <g transform={'translate(' + TARGET.x + ' ' + TARGET.y + ')'}>
        <ellipse cy="2" rx="61" ry="28" fill="#eaf1fa" />
        <circle r="27" fill="#fff" stroke={BLUE} strokeWidth="2" />
        <path d="M -8 -10 L 5 -13 L 14 -4 L 10 10 L -3 14 L -13 4 Z" fill="#e5edf9" stroke="#6488b8" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M -8 -10 L -1 0 L 10 10 M -1 0 L 14 -4 M -1 0 L -3 14" fill="none" stroke="#8fa7c8" strokeWidth="1.3" />
        <path d="M -35 0 H -41 M 35 0 H 41 M 0 -35 V -41 M 0 35 V 43" stroke={BLUE} strokeWidth="1.8" opacity="0.5" />
        <text y="68" textAnchor="middle" fill={BLUE} fontSize="22" fontWeight="500">Target</text>
      </g>
      {index < 2 && <g opacity={landed}>
        <path d={'M ' + attempt.end.x + ' ' + attempt.end.y + ' L ' + TARGET.x + ' ' + TARGET.y} fill="none" stroke={ERROR} strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" />
        <circle cx={attempt.end.x} cy={attempt.end.y} r="7" fill="none" stroke={ERROR} strokeWidth="1.6" />
        <text x={index === 0 ? 210 : 258} y="255" textAnchor="middle" fill={ERROR} fontSize="22" fontWeight="500">{index === 0 ? 'Missed reach' : 'Remaining gap'}</text>
      </g>}
      <Gripper x={x} y={y} close={index === 2 ? ramp(t, 16.2, 16.7) : 0} />
      {t < attempt.start && <text x="148" y="210" textAnchor="middle" fill={MUTED} fontSize="21">Gripper</text>}
      {success > 0 && <g transform="translate(426 135)" opacity={success}>
        <circle r="16" fill={BLUE} />
        <path d="M -7 0 L -2 5 L 8 -6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
    </g>
  </svg>;
};

const Footage: React.FC<{index: number; frame: number; t: number}> = ({index, frame, t}) => {
  const attempt = ATTEMPTS[index];
  const future = t < attempt.slot;
  const style: React.CSSProperties = {width: '100%', height: '100%', objectFit: 'cover'};
  return <AbsoluteFill style={{background: '#e9eaed', overflow: 'hidden', borderRadius: 13}}>
    {future ? <Img src={staticFile('run_ghost_' + (index + 1) + '.jpg')} style={{...style, opacity: 0.28}} /> :
      <Freeze frame={Math.min(frame, attempt.lastFrame)}>
        <OffthreadVideo src={staticFile('stairs_run_3x.mp4')} muted style={style} />
      </Freeze>}
    {future && <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', color: '#59616e', fontSize: 22, fontWeight: 500}}>Next attempt</AbsoluteFill>}
  </AbsoluteFill>;
};

const AttemptCard: React.FC<{index: number; frame: number; t: number; mobile: boolean}> = ({index, frame, t, mobile}) => {
  const active = activeAttempt(t) === index;
  const attempt = ATTEMPTS[index];
  const done = t >= attempt.land;
  const future = t < attempt.slot;
  const status = future ? 'Up next' : done ? (index === 2 ? 'Grasp' : 'Miss') : t < 3.4 ? 'Climbing' : 'Reaching';
  const progress = Math.max(0, Math.min(1, (frame - attempt.slot * 30) / (attempt.lastFrame - attempt.slot * 30)));
  const titleStyle: React.CSSProperties = {position: 'absolute', top: mobile ? 30 : 24, left: mobile ? 30 : 24, right: mobile ? 30 : 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: mobile ? 34 : 25, lineHeight: 1.2};
  const captions = ['Learning starts from zero.', 'Updated after attempt 1.', 'Updated after attempt 2.'];
  return <div style={{position: 'absolute', left: mobile ? 32 : 36 + index * 640, top: mobile ? 104 : 24, width: mobile ? 896 : 568, height: mobile ? 1236 : 808, borderRadius: mobile ? 28 : 22, background: '#fff', border: '1.5px solid ' + (active ? '#d6e1f0' : '#e8e9ed'), boxShadow: active ? '0 10px 32px rgba(30,50,80,.035)' : 'none'}}>
    <div style={titleStyle}>
      <span style={{color: active ? BLUE : MUTED, fontWeight: 500}}>Attempt {String(index + 1).padStart(2, '0')}</span>
      <span style={{display: 'flex', gap: 10, alignItems: 'center', color: future ? '#a3a7af' : index === 2 && done ? BLUE : INK, fontWeight: 600}}><span style={{height: mobile ? 10 : 7, width: mobile ? 10 : 7, borderRadius: 99, background: active ? BLUE : '#d4d8df'}} />{status}</span>
    </div>
    <div style={{position: 'absolute', top: mobile ? 88 : 72, left: mobile ? 24 : 20, width: mobile ? 848 : 528, height: mobile ? 636 : 396}}>
      <Footage index={index} frame={frame} t={t} />
      <div style={{position: 'absolute', left: 12, right: 12, bottom: 9, height: 3, background: 'rgba(255,255,255,.3)', borderRadius: 2}}><div style={{height: '100%', width: progress * 100 + '%', borderRadius: 2, background: '#fff'}} /></div>
    </div>
    <div style={{position: 'absolute', top: mobile ? 750 : 478, left: mobile ? 48 : 0, width: mobile ? 800 : 568, height: mobile ? 394 : 280}}><Reach index={index} t={t} /></div>
    <div style={{position: 'absolute', left: mobile ? 30 : 24, right: mobile ? 30 : 24, bottom: mobile ? 38 : 30, textAlign: 'center', fontSize: mobile ? 31 : 24, color: future ? '#a3a7af' : '#626874', fontWeight: 400, letterSpacing: '-.3px'}}>{captions[index]}</div>
  </div>;
};

const Update: React.FC<{t: number; start: number; x: number}> = ({t, start, x}) => {
  const p = ramp(t, start, start + 0.35);
  const spin = ramp(t, start, start + 0.7);
  return <svg width="72" height="116" viewBox="0 0 72 116" style={{position: 'absolute', left: x - 36, top: 600, overflow: 'visible', opacity: mix(0.25, 1, p)}}>
    <g transform="translate(36 28)">
      <circle r="23" fill="#e4edf9" />
      <g transform={'rotate(' + spin * 180 + ')'} fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M -9 -4 A 10 10 0 0 1 9 -5 M 9 -11 V -5 H 3 M 9 4 A 10 10 0 0 1 -9 5 M -9 11 V 5 H -3" /></g>
    </g>
    <text x="36" y="76" textAnchor="middle" fontSize="21" fontWeight="500" fill={BLUE}>Learn</text>
    <path d="M 17 98 H 55 M 48 91 L 55 98 L 48 105" fill="none" stroke={BLUE} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
};

export const LearningLoop: React.FC<{mobile: boolean}> = ({mobile}) => {
  const [fontHandle] = useState(() => delayRender('Load the bundled Geist font'));
  useEffect(() => {
    Promise.all([400, 500, 600].map(weight => document.fonts.load(weight + ' 24px Geist')))
      .then(() => continueRender(fontHandle));
  }, [fontHandle]);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const active = activeAttempt(t);
  return <AbsoluteFill style={{background: BG, fontFamily: 'Geist, sans-serif'}}>
    {mobile ? <>
      <div style={{position: 'absolute', top: 28, left: 50, right: 50, display: 'flex', gap: 18}}>
        {[0, 1, 2].map(i => <div key={i} style={{flex: 1, color: i === active ? BLUE : MUTED, fontSize: 25, fontWeight: i === active ? 600 : 400}}>
          <div style={{height: 5, borderRadius: 3, background: i <= active ? BLUE : '#dfe2e7', marginBottom: 15}} />
          {i === active ? 'Attempt ' + (i + 1) : i < active ? (i + 1) + ' · Miss' : (i + 1) + ' · Up next'}
        </div>)}
      </div>
      <AttemptCard index={active} frame={frame} t={t} mobile />
    </> : <>
      {[0, 1, 2].map(i => <AttemptCard key={i} index={i} frame={frame} t={t} mobile={false} />)}
      <Update t={t} start={8} x={640} />
      <Update t={t} start={13} x={1280} />
    </>}
  </AbsoluteFill>;
};
