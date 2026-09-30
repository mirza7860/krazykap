import type { Metadata } from "next";
import { RoomControl } from "@/components/room-control";

export const metadata: Metadata = { title: "Room control" };

export default async function RoomPage(props: PageProps<"/room/[code]">) {
  const { code } = await props.params;
  return <RoomControl code={code} />;
}
