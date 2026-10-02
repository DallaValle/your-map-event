import type en from "../../messages/en.json";

// English is the source catalog: keys are typed against it.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
  }
}
