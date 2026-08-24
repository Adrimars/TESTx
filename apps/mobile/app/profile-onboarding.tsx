import { useRouter } from "expo-router";
import { Placeholder } from "@/components/Placeholder";
import { LinkButton } from "@/components/LinkButton";

export default function ProfileOnboardingScreen() {
  const router = useRouter();
  return (
    <Placeholder
      title="Your profile"
      subtitle="The evaluatorProfileSchema form lands in Phase 9.3; the API rejects the feed with PROFILE_REQUIRED until it is filled in."
    >
      <LinkButton label="Go to feed" onPress={() => router.replace("/feed")} />
    </Placeholder>
  );
}
