import type { Metadata } from "next";
import { NflQuery } from "@/components/nfl-query";

export const metadata: Metadata = {
  title: "Magic Stats",
  description:
    "Ask any NFL stats question in plain English. Answers come from every play since 1999.",
};

export default function Home() {
  return <NflQuery />;
}
