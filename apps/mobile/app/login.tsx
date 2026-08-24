import { useRouter } from "expo-router";
import { Placeholder } from "@/components/Placeholder";
import { LinkButton } from "@/components/LinkButton";

export default function LoginScreen() {
  const router = useRouter();
  return (
    <Placeholder
      title="Sign in"
      subtitle="Email/password, Google and Apple sign-in land in Phase 9.3."
    >
      <LinkButton label="Create an account" onPress={() => router.push("/register")} />
    </Placeholder>
  );
}
