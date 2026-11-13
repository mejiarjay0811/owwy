import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");
// Quality tuned for social platforms re-encoding the upload.
Config.setCrf(18);
Config.setEntryPoint("./src/index.ts");
