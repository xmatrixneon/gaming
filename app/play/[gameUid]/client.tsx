/**
 * Game Play Client Component
 *
 * Handles game launch URL fetching and iframe rendering.
 */

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Maximize2, Minimize2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

interface GamePlayClientProps {
  gameUid: string;
}

export default function GamePlayClient({ gameUid }: GamePlayClientProps) {
  const router = useRouter();
  const [gameUrl, setGameUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [hasLaunched, setHasLaunched] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Fetch game launch URL mutation
  const launchGameMutation = api.game.launchGame.useMutation({
    onSuccess: (data) => {
      if (data?.gameUrl) {
        setGameUrl(data.gameUrl);
        setError(null);
      } else {
        setError("Failed to launch game");
      }
      setIsLoading(false);
    },
    onError: (err) => {
      console.error("Game launch failed:", err);
      setError(err.message || "Failed to launch game");
      setIsLoading(false);
    },
  });

  // Launch game on mount - only once
  React.useEffect(() => {
    if (gameUid && !hasLaunched) {
      setHasLaunched(true);
      launchGameMutation.mutate({ gameUid });
    }
  }, [gameUid]); // Remove launchGameMutation and hasLaunched from deps

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setError("Unable to load the game. Please try again later.");
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen && iframeRef.current) {
      const container = iframeRef.current.parentElement;
      if (container) {
        container.requestFullscreen().catch(() => {
          setIsFullscreen(!isFullscreen);
        });
      }
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Handle fullscreen change
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Go back
  const handleGoBack = () => {
    router.back();
  };

  const isPending = launchGameMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleGoBack}
          className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleFullscreen}
            className="h-9 w-9 bg-black/50 hover:bg-black/70 text-white border-0"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </span>
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {(isLoading || isPending) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="mt-4 text-sm text-muted-foreground">
            {isPending ? "Launching game..." : "Loading game..."}
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-20 p-4">
          <div className="text-6xl mb-4">🎮</div>
          <h3 className="text-lg font-semibold mb-2">Game Launch Failed</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
          <Button onClick={handleGoBack}>Go Back</Button>
        </div>
      )}

      {/* Game iframe */}
      {gameUrl && (
        <iframe
          ref={iframeRef}
          src={gameUrl}
          className={cn(
            "w-full h-full border-0",
            isLoading || isPending ? "opacity-0" : "opacity-100"
          )}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          title="Game"
        />
      )}
    </div>
  );
}
