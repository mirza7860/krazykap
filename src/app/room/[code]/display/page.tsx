import type { Metadata } from "next";
import { DisplayBoard } from "@/components/display-board";

export const metadata: Metadata = {
  title: "Classroom display",
  robots: { index: false },
};

export default async function DisplayPage(props: PageProps<"/room/[code]/display">) {
  const { code } = await props.params;
  return <DisplayBoard code={code} />;
}
