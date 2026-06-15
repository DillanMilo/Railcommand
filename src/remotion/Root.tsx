import { Composition } from 'remotion';
import { RailCommandLaunch } from './RailCommandLaunch';

export const RemotionRoot = () => {
  return (
    <Composition
      id="RailCommandLaunch"
      component={RailCommandLaunch}
      durationInFrames={1170}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
