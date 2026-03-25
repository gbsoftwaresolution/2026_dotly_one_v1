import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  CardAttachmentResponse,
  CardContactGate,
  CardContactRevealResponse,
  CreateCardContactRequestDto,
  CreateCardContactRequestResponse,
  GetPublicCardModeResponse,
} from "@booster-vault/shared";
import { cardApi } from "../api/card";
import { ApiError } from "../api/client";
import { Loading } from "../components/Loading";
import { ErrorState } from "../components/ErrorState";

function asMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.data?.message || err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

function sessionTokenKey(publicId: string, modeSlug: string): string {
  return `card-token:${publicId}:${modeSlug}`;
}

function safeVcfFilename(publicId: string, modeSlug: string): string {
  const raw = `card-${publicId}-${modeSlug}.vcf`;
  return raw.replace(/[^a-z0-9._-]+/gi, "-");
}

function isShareAlbumAttachment(
  attachment: CardAttachmentResponse,
): attachment is CardAttachmentResponse & {
  resolvedLink: NonNullable<CardAttachmentResponse["resolvedLink"]>;
} {
  return attachment.resolvedLink?.kind === "SHARED_ALBUM";
}

export const PublicCardModePage: React.FC = () => {
  const { publicId: rawPublicId, modeSlug: rawModeSlug } = useParams<{
    publicId: string;
    modeSlug?: string;
  }>();

  const publicId = (rawPublicId ?? "").trim();
  const modeSlug = (rawModeSlug ?? "personal").trim() || "personal";

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GetPublicCardModeResponse | null>(null);

  const [requestDto, setRequestDto] = useState<CreateCardContactRequestDto>({
    requesterName: "",
    requesterEmail: "",
    requesterPhone: "",
    message: "",
    captchaToken: "",
  });
  const [requestStatus, setRequestStatus] = useState<{
    isSubmitting: boolean;
    error: string | null;
    result: CreateCardContactRequestResponse | null;
  }>({ isSubmitting: false, error: null, result: null });

  const [token, setToken] = useState<string>("");
  const [reveal, setReveal] = useState<{
    isLoading: boolean;
    error: string | null;
    contact: CardContactRevealResponse | null;
  }>({ isLoading: false, error: null, contact: null });

  const [isDownloadingVcf, setIsDownloadingVcf] = useState(false);

  const contactGate: CardContactGate | null = data?.mode?.contactGate ?? null;

  const sortedAttachments = useMemo(() => {
    const items = data?.attachments ?? [];
    return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  useEffect(() => {
    if (!publicId) {
      setIsLoading(false);
      setError("Missing card id");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await cardApi.getPublicMode(publicId, modeSlug);
        if (cancelled) return;
        setData(res);
      } catch (e) {
        if (cancelled) return;
        setError(asMessage(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicId, modeSlug]);

  useEffect(() => {
    if (!publicId) return;
    try {
      const key = sessionTokenKey(publicId, modeSlug);
      const existing = sessionStorage.getItem(key);
      if (existing && existing.trim()) setToken(existing);
    } catch {
      // ignore
    }
  }, [publicId, modeSlug]);

  useEffect(() => {
    if (!publicId) return;
    try {
      const key = sessionTokenKey(publicId, modeSlug);
      const v = token.trim();
      if (v) sessionStorage.setItem(key, v);
      else sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [publicId, modeSlug, token]);

  const submitContactRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicId) return;

    setRequestStatus({ isSubmitting: true, error: null, result: null });
    try {
      const dto: CreateCardContactRequestDto = {
        requesterName: requestDto.requesterName,
        requesterEmail: requestDto.requesterEmail,
        requesterPhone: requestDto.requesterPhone?.trim() || undefined,
        message: requestDto.message?.trim() || undefined,
        captchaToken: requestDto.captchaToken?.trim() || undefined,
      };

      const res = await cardApi.createContactRequest(publicId, modeSlug, dto);
      setRequestStatus({ isSubmitting: false, error: null, result: res });
    } catch (e2) {
      setRequestStatus({
        isSubmitting: false,
        error: asMessage(e2),
        result: null,
      });
    }
  };

  const revealContact = async () => {
    if (!publicId) return;

    const t = token.trim();
    if (!t) {
      setReveal((prev) => ({ ...prev, error: "Enter an access token" }));
      return;
    }

    setReveal({ isLoading: true, error: null, contact: null });
    try {
      const contact = await cardApi.revealContact(publicId, modeSlug, t);
      setReveal({ isLoading: false, error: null, contact });
    } catch (e) {
      setReveal({ isLoading: false, error: asMessage(e), contact: null });
    }
  };

  const downloadVCard = async () => {
    if (!publicId) return;

    const t = token.trim();
    if (!t) {
      setReveal((prev) => ({ ...prev, error: "Enter an access token" }));
      return;
    }

    setIsDownloadingVcf(true);
    try {
      const blob = await cardApi.downloadVCard(publicId, modeSlug, t);
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = safeVcfFilename(publicId, modeSlug);
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setReveal((prev) => ({ ...prev, error: asMessage(e) }));
    } finally {
      setIsDownloadingVcf(false);
    }
  };

  if (isLoading) return <Loading message="Loading card..." />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <ErrorState message="Card not found" />;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        padding: "var(--space-10) var(--space-6)",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-10)",
            marginBottom: "var(--space-8)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{ margin: 0, fontSize: "2rem", letterSpacing: "-0.02em" }}
            >
              {data.mode.name}
            </h1>
            <span style={{ color: "var(--text-tertiary)", fontSize: "0.9rem" }}>
              / {modeSlug}
            </span>
          </div>

          {data.mode.headline && (
            <p
              style={{
                marginTop: "var(--space-4)",
                marginBottom: 0,
                color: "var(--text-secondary)",
                fontSize: "1.1rem",
              }}
            >
              {data.mode.headline}
            </p>
          )}

          {data.mode.bio && (
            <p
              style={{
                marginTop: "var(--space-6)",
                marginBottom: 0,
                color: "var(--text-secondary)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {data.mode.bio}
            </p>
          )}
        </div>

        {/* Attachments */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-10)",
            marginBottom: "var(--space-8)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "var(--space-6)",
              fontSize: "1.25rem",
            }}
          >
            Attachments
          </h2>

          {sortedAttachments.length === 0 ? (
            <p style={{ margin: 0, color: "var(--text-tertiary)" }}>
              No attachments.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              {sortedAttachments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-4)",
                    padding: "var(--space-4)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.label || "Album"}</div>
                    <div
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "0.875rem",
                      }}
                    >
                      {a.kind}
                    </div>
                  </div>

                  {isShareAlbumAttachment(a) ? (
                    <Link
                      to={`/shared/${a.resolvedLink.shareId}`}
                      className="btn btn-secondary"
                    >
                      Open album
                    </Link>
                  ) : (
                    <span
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "0.875rem",
                      }}
                    >
                      Unavailable
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact access */}
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-primary)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-10)",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "var(--space-6)",
              fontSize: "1.25rem",
            }}
          >
            Contact
          </h2>

          {contactGate === "HIDDEN" ? (
            <p style={{ margin: 0, color: "var(--text-tertiary)" }}>
              Contact is hidden for this card.
            </p>
          ) : (
            <>
              {contactGate === "REQUEST_REQUIRED" && (
                <div style={{ marginBottom: "var(--space-10)" }}>
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "var(--space-4)",
                      fontSize: "1.05rem",
                    }}
                  >
                    Request access
                  </h3>

                  {requestStatus.result ? (
                    <div
                      style={{
                        border: "1px solid var(--border-primary)",
                        borderRadius: "var(--radius-lg)",
                        padding: "var(--space-4)",
                        background: "var(--bg-tertiary)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: "var(--space-2)",
                        }}
                      >
                        Request sent
                      </div>
                      <div
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "0.9rem",
                        }}
                      >
                        Status: {requestStatus.result.status}
                      </div>
                      <div
                        style={{
                          color: "var(--text-tertiary)",
                          fontSize: "0.8rem",
                          marginTop: "var(--space-2)",
                        }}
                      >
                        Request ID: {requestStatus.result.requestId}
                      </div>
                    </div>
                  ) : (
                    <form
                      onSubmit={submitContactRequest}
                      style={{ display: "grid", gap: "var(--space-4)" }}
                    >
                      <input
                        value={requestDto.requesterName}
                        onChange={(e) =>
                          setRequestDto((p) => ({
                            ...p,
                            requesterName: e.target.value,
                          }))
                        }
                        placeholder="Your name"
                        required
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                        }}
                      />

                      <input
                        value={requestDto.requesterEmail}
                        onChange={(e) =>
                          setRequestDto((p) => ({
                            ...p,
                            requesterEmail: e.target.value,
                          }))
                        }
                        placeholder="Your email"
                        required
                        type="email"
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                        }}
                      />

                      <input
                        value={requestDto.requesterPhone ?? ""}
                        onChange={(e) =>
                          setRequestDto((p) => ({
                            ...p,
                            requesterPhone: e.target.value,
                          }))
                        }
                        placeholder="Your phone (optional)"
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                        }}
                      />

                      <textarea
                        value={requestDto.message ?? ""}
                        onChange={(e) =>
                          setRequestDto((p) => ({
                            ...p,
                            message: e.target.value,
                          }))
                        }
                        placeholder="Message (optional)"
                        rows={4}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                          resize: "vertical",
                        }}
                      />

                      <input
                        value={requestDto.captchaToken ?? ""}
                        onChange={(e) =>
                          setRequestDto((p) => ({
                            ...p,
                            captchaToken: e.target.value,
                          }))
                        }
                        placeholder="Captcha token (only if required)"
                        style={{
                          padding: "12px 14px",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--border-primary)",
                          background: "var(--bg-tertiary)",
                          color: "var(--text-primary)",
                        }}
                      />

                      {requestStatus.error && (
                        <div
                          style={{ color: "var(--danger)", fontSize: "0.9rem" }}
                        >
                          {requestStatus.error}
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: "var(--space-3)",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="btn btn-primary"
                          type="submit"
                          disabled={requestStatus.isSubmitting}
                        >
                          {requestStatus.isSubmitting
                            ? "Sending..."
                            : "Request access"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {contactGate === "OPEN" && (
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: "var(--space-10)",
                    color: "var(--text-secondary)",
                  }}
                >
                  Contact access is open, but you still need an access token to
                  reveal details.
                </p>
              )}

              <div style={{ display: "grid", gap: "var(--space-4)" }}>
                <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                  Have a token?
                </h3>

                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste access token"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-primary)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void revealContact()}
                    disabled={reveal.isLoading}
                  >
                    {reveal.isLoading ? "Revealing..." : "Reveal contact"}
                  </button>

                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => void downloadVCard()}
                    disabled={isDownloadingVcf}
                  >
                    {isDownloadingVcf ? "Downloading..." : "Download vCard"}
                  </button>
                </div>

                {reveal.error && (
                  <div
                    style={{ color: "var(--danger)", fontSize: "0.9rem" }}
                    data-testid="card-reveal-error"
                  >
                    {reveal.error}
                  </div>
                )}

                {reveal.contact && (
                  <div
                    style={{
                      border: "1px solid var(--border-primary)",
                      borderRadius: "var(--radius-lg)",
                      padding: "var(--space-4)",
                      background: "var(--bg-tertiary)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: "var(--space-2)",
                      }}
                    >
                      Revealed contact
                    </div>
                    {reveal.contact.displayName && (
                      <div style={{ color: "var(--text-secondary)" }}>
                        {reveal.contact.displayName}
                      </div>
                    )}
                    {reveal.contact.email && (
                      <div style={{ color: "var(--text-secondary)" }}>
                        {reveal.contact.email}
                      </div>
                    )}
                    {!reveal.contact.displayName && !reveal.contact.email && (
                      <div style={{ color: "var(--text-tertiary)" }}>
                        No contact fields available.
                      </div>
                    )}
                  </div>
                )}

                <div
                  style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}
                >
                  Token is stored in session storage for this tab.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
