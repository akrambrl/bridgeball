import { Composition } from "remotion";
import { Ad } from "./Ad";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Ad"
      component={Ad}
      durationInFrames={480}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
