import React from "react";
import { Composition, registerRoot } from "remotion";

import { defaultReleaseDemoProps, ReleaseDemo } from "./ReleaseDemo";

function RemotionRoot() {
  return (
    <Composition
      id="ProofPitchProductDemo"
      component={ReleaseDemo}
      durationInFrames={180}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultReleaseDemoProps}
    />
  );
}

registerRoot(RemotionRoot);
