/**
 * Game Play Page
 *
 * Full-page iframe game experience.
 * When a user clicks a game card, they navigate here where the game loads
 * in a full-page iframe that replaces all other content.
 */

import { notFound } from "next/navigation";
import GamePlayClient from "./client";

interface GamePlayPageProps {
  params: Promise<{
    gameUid: string;
  }>;
}

export default async function GamePlayPage({ params }: GamePlayPageProps) {
  const { gameUid } = await params;

  if (!gameUid) {
    notFound();
  }

  return <GamePlayClient gameUid={gameUid} />;
}
