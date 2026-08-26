export * from "./asset-storage";
export * from "./mime-validator";
export * from "./local-asset-storage";

import { localAssetStorage } from "./local-asset-storage";
export const assetStorage = localAssetStorage;

