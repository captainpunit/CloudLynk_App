import { useEffect } from "react";
import { Stack } from "expo-router";
import { initMetaSdk } from "@/services/meta/metaEvents";
import { captureInstallAttribution } from "@/services/attribution/installReferrer";

export default function RootLayout() {
  useEffect(() => {
    // TODO: gate on the user's tracking consent before init (Play Data safety + Meta terms).
    initMetaSdk();
    void captureInstallAttribution();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
