import type { Metadata } from "next";
import { StudentPlay } from "@/components/student-play";

export const metadata: Metadata = {
  title: "Join class",
  robots: { index: false },
};

export default async function JoinRoomPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;
  return <StudentPlay code={code.toUpperCase()} />;
}
