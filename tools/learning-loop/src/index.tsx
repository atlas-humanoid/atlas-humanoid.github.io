import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {LearningLoop} from './LearningLoop';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';

const Root: React.FC = () => <>
  <Composition id="LearningLoop" component={LearningLoop} width={1920} height={640} fps={30} durationInFrames={630} defaultProps={{mobile: false}} />
  <Composition id="LearningLoopMobile" component={LearningLoop} width={960} height={900} fps={30} durationInFrames={630} defaultProps={{mobile: true}} />
</>;

registerRoot(Root);
