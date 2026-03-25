import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { CheckIcon } from "../components/icons/CheckIcon";

const Stars = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2,
      speedX: (Math.random() - 0.5) * 0.2,
      speedY: (Math.random() - 0.5) * 0.2,
      opacity: Math.random(),
    }));

    let animationFrameId: number;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      stars.forEach((star) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.x += star.speedX;
        star.y += star.speedY;

        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;
        if (star.y < 0) star.y = height;
        if (star.y > height) star.y = 0;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0.4,
      }}
    />
  );
};

const HeroIcon = ({ status }: { status: "loading" | "success" | "error" }) => {
  if (status === "loading") {
    return (
      <div
        style={{
          position: "relative",
          width: "96px",
          height: "96px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "4px solid var(--onyx-light)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "4px solid transparent",
            borderTopColor: "var(--accent-primary)",
            borderRadius: "50%",
            filter: "drop-shadow(0 0 8px var(--accent-primary-glow))",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div
        style={{
          position: "relative",
          width: "96px",
          height: "96px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -20,
            background:
              "radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)",
            animation: "pulse 2s infinite",
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 30px rgba(16, 185, 129, 0.4)",
            animation: "scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div style={{ color: "#fff" }}>
            <CheckIcon size={48} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "96px",
        height: "96px",
        borderRadius: "50%",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        border: "2px solid rgba(239, 68, 68, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto",
        animation: "shake 0.5s ease-in-out",
        boxShadow: "0 0 20px rgba(239, 68, 68, 0.2)",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--danger)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
  );
};

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = searchParams.get("token");

    // Add a small delay for better UX (prevent flashing)
    const minTime = new Promise((resolve) => setTimeout(resolve, 1500)); // Slightly longer for the "wow"

    if (!token) {
      minTime.then(() => {
        setStatus("error");
        setMessage("Invalid verification link.");
      });
      return;
    }

    const verify = async () => {
      try {
        await Promise.all([authApi.verifyEmail(token), minTime]);
        setStatus("success");
        setMessage("Your email has been verified successfully.");
      } catch (error: any) {
        await minTime;
        setStatus("error");
        setMessage(
          error.message ||
            "Verification failed. The link may be invalid or expired.",
        );
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#000",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Stars />

      {/* Dynamic gradients */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "50vw",
          height: "50vw",
          background:
            "radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 60%)",
          filter: "blur(60px)",
          animation: "float 10s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: "50vw",
          height: "50vw",
          background:
            "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 60%)",
          filter: "blur(60px)",
          animation: "float 15s ease-in-out infinite reverse",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          margin: "1rem",
          padding: "3.5rem 2.5rem",
          backgroundColor: "rgba(20, 20, 20, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "24px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          animation: "fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          transform: "translateZ(0)",
        }}
      >
        <div style={{ marginBottom: "2.5rem" }}>
          <HeroIcon status={status} />
        </div>

        <h1
          style={{
            marginBottom: "1rem",
            fontSize: "2rem",
            fontWeight: 800,
            background:
              status === "success"
                ? "linear-gradient(to right, #ffffff, #a1a1a1)"
                : "linear-gradient(to right, #ffffff, #a1a1a1)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.03em",
          }}
        >
          {status === "loading"
            ? "Verifying..."
            : status === "success"
              ? "You're All Set!"
              : "Verification Failed"}
        </h1>

        <p
          style={{
            fontSize: "1.125rem",
            color: "rgba(255, 255, 255, 0.6)",
            lineHeight: 1.6,
            marginBottom: "3rem",
            maxWidth: "85%",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {message}
        </p>

        <div>
          <button
            onClick={() => navigate("/login")}
            style={{
              width: "100%",
              padding: "1rem 1.5rem",
              background:
                status === "success"
                  ? "linear-gradient(135deg, var(--accent-primary) 0%, #0099ff 100%)"
                  : "rgba(255, 255, 255, 0.05)",
              color: status === "success" ? "#000" : "#fff",
              border:
                status === "success"
                  ? "none"
                  : "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              fontSize: "1.05rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              opacity: status === "loading" ? 0.6 : 1,
              pointerEvents: status === "loading" ? "none" : "auto",
              boxShadow:
                status === "success"
                  ? "0 10px 30px -10px rgba(0, 212, 255, 0.5)"
                  : "none",
              transform: "translateZ(0)",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
              if (status === "success") {
                e.currentTarget.style.boxShadow =
                  "0 20px 40px -10px rgba(0, 212, 255, 0.6)";
              } else {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0) scale(1)";
              if (status === "success") {
                e.currentTarget.style.boxShadow =
                  "0 10px 30px -10px rgba(0, 212, 255, 0.5)";
              } else {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              }
            }}
          >
            {status === "success" ? "Get Started" : "Back to Login"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes scaleIn {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeInUp {
          0% { transform: translateY(40px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        @keyframes float {
          0% { transform: translate(0, 0); }
          50% { transform: translate(50px, 50px); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
};
