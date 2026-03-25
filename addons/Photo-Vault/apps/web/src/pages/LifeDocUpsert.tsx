import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type {
  LifeDocCategory,
  LifeDocReminderSetting,
  LifeDocSubcategory,
  LifeDocVisibility,
} from "@booster-vault/shared/life-docs/types";
import {
  LifeDocCategory as LifeDocCategoryEnum,
  LifeDocReminderSetting as LifeDocReminderSettingEnum,
  LifeDocSubcategory as LifeDocSubcategoryEnum,
  LifeDocVisibility as LifeDocVisibilityEnum,
} from "@booster-vault/shared/life-docs/types";
import type { LifeDocResponse, MediaResponse } from "@booster-vault/shared";
import { lifeDocsApi } from "../api/lifeDocs";
import { mediaApi } from "../api/media";
import { Loading } from "../components/Loading";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { UploadDialog } from "../components/UploadDialog";
import { VaultUnlockModal } from "../components/VaultUnlockModal";
import { useToast } from "../components/ToastProvider";
import {
  canManageLifeDoc,
  subcategoryLabel,
  visibilityLabel,
} from "../utils/lifeDocs";
import {
  ShieldIcon,
  CreditCardIcon,
  UsersIcon,
  FileCodeIcon,
  CheckIcon,
  CloudIcon,
} from "../components/icons";

// --- Icons & Themes ---
interface CategoryMeta {
  label: string;
  icon: React.FC<any>;
  color: string;
  bg: string;
}

const CATEGORY_THEMES: Record<LifeDocCategory, CategoryMeta> = {
  IDENTITY_LEGAL: {
    label: "Identity & Legal",
    icon: ShieldIcon,
    color: "#007AFF",
    bg: "rgba(0, 122, 255, 0.1)",
  },
  FINANCIAL_ASSET: {
    label: "Financial & Assets",
    icon: CreditCardIcon,
    color: "#34C759",
    bg: "rgba(52, 199, 89, 0.1)",
  },
  MEDICAL: {
    label: "Medical",
    icon: UsersIcon,
    color: "#FF3B30",
    bg: "rgba(255, 59, 48, 0.1)",
  },
  EDUCATION_CAREER: {
    label: "Education & Career",
    icon: FileCodeIcon,
    color: "#FF9500",
    bg: "rgba(255, 149, 0, 0.1)",
  },
};

const SUBCATEGORIES_BY_CATEGORY: Record<LifeDocCategory, LifeDocSubcategory[]> =
  {
    IDENTITY_LEGAL: [
      LifeDocSubcategoryEnum.PASSPORT,
      LifeDocSubcategoryEnum.NATIONAL_ID,
      LifeDocSubcategoryEnum.DRIVERS_LICENSE,
      LifeDocSubcategoryEnum.VISA,
      LifeDocSubcategoryEnum.RESIDENCY_PERMIT,
      LifeDocSubcategoryEnum.BIRTH_CERTIFICATE,
      LifeDocSubcategoryEnum.MARRIAGE_CERTIFICATE,
      LifeDocSubcategoryEnum.DIVORCE_DECREE,
    ],
    MEDICAL: [
      LifeDocSubcategoryEnum.MEDICAL_REPORTS,
      LifeDocSubcategoryEnum.PRESCRIPTIONS,
      LifeDocSubcategoryEnum.VACCINATION_RECORDS,
      LifeDocSubcategoryEnum.INSURANCE_CARDS,
      LifeDocSubcategoryEnum.DISABILITY_DOCUMENTS,
    ],
    EDUCATION_CAREER: [
      LifeDocSubcategoryEnum.DEGREES,
      LifeDocSubcategoryEnum.CERTIFICATES,
      LifeDocSubcategoryEnum.TRANSCRIPTS,
      LifeDocSubcategoryEnum.PROFESSIONAL_LICENSES,
      LifeDocSubcategoryEnum.EMPLOYMENT_CONTRACTS,
    ],
    FINANCIAL_ASSET: [
      LifeDocSubcategoryEnum.INSURANCE_POLICIES,
      LifeDocSubcategoryEnum.PROPERTY_DEEDS,
      LifeDocSubcategoryEnum.RENTAL_AGREEMENTS,
      LifeDocSubcategoryEnum.LOAN_AGREEMENTS,
      LifeDocSubcategoryEnum.WILLS,
      LifeDocSubcategoryEnum.POWER_OF_ATTORNEY,
    ],
  };

type Mode = "create" | "edit" | "replace";

function isoDateOrEmpty(value?: string | null): string {
  return value || "";
}

// --- Components ---

function SectionHeader({ title }: { title: string }) {
  return <h3 className="lifeDocsSectionHeader">{title}</h3>;
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: any) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="form-input"
      />
    </div>
  );
}

export const LifeDocUpsert: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const mode: Mode = useMemo(() => {
    if (!id) return "create";
    if (location.pathname.endsWith("/replace")) return "replace";
    return "edit";
  }, [id, location.pathname]);

  const [baseDoc, setBaseDoc] = useState<LifeDocResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [mediaId, setMediaId] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<MediaResponse | null>(
    null,
  );
  const [category, setCategory] = useState<LifeDocCategory>(
    LifeDocCategoryEnum.IDENTITY_LEGAL,
  );
  const [subcategory, setSubcategory] = useState<LifeDocSubcategory>(
    LifeDocSubcategoryEnum.PASSPORT,
  );
  const [customSubcategory, setCustomSubcategory] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [issuingAuthority, setIssuingAuthority] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [renewalRequired, setRenewalRequired] = useState<boolean>(false);
  const [reminderSetting, setReminderSetting] =
    useState<LifeDocReminderSetting>(LifeDocReminderSettingEnum.EXPIRY_DEFAULT);
  const [visibility, setVisibility] = useState<LifeDocVisibility>(
    LifeDocVisibilityEnum.PRIVATE,
  );

  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [needUnlockModalOpen, setNeedUnlockModalOpen] = useState(false);

  const canManage = useMemo(() => {
    if (!baseDoc) return mode === "create";
    return canManageLifeDoc(baseDoc.viewerRole);
  }, [baseDoc, mode]);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (mode === "edit" || mode === "replace") {
          if (!id) throw new Error("Missing id");
          const d = await lifeDocsApi.get(id);
          setBaseDoc(d);
          setCategory(d.category);
          setSubcategory(d.subcategory);
          setCustomSubcategory(d.customSubcategory || "");
          setTitle(d.title);
          setIssuingAuthority(d.issuingAuthority || "");
          setIssueDate(isoDateOrEmpty(d.issueDate));
          setExpiryDate(isoDateOrEmpty(d.expiryDate));
          setRenewalRequired(!!d.renewalRequired);
          setReminderSetting(d.reminderSetting);
          setVisibility(d.visibility);
        } else {
          setBaseDoc(null);
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id, mode]);

  useEffect(() => {
    // Keep subcategory consistent with category (except CUSTOM).
    if (String(subcategory) === "CUSTOM") return;
    const allowed = SUBCATEGORIES_BY_CATEGORY[category] || [];
    if (!allowed.includes(subcategory)) {
      setSubcategory(allowed[0] || LifeDocSubcategoryEnum.PASSPORT);
    }
  }, [category, subcategory]);

  // Load selected media details when mediaId changes (e.g. after picking)
  useEffect(() => {
    if (mediaId && !selectedMedia) {
      void (async () => {
        try {
          const res = await mediaApi.get(mediaId);
          setSelectedMedia(res);
          // Suggest title if empty
          if (!title && res.originalFilename) {
            setTitle(res.originalFilename.replace(/\.[^/.]+$/, ""));
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [mediaId]);

  const isMetaEditable = mode !== "replace";

  const subcategoryOptions = useMemo(() => {
    const recommended = SUBCATEGORIES_BY_CATEGORY[category] || [];
    const all = Object.values(LifeDocSubcategoryEnum).filter(
      (v) => String(v) !== "CUSTOM",
    ) as LifeDocSubcategory[];

    const recommendedSet = new Set(recommended.map(String));
    const other = all.filter((v) => !recommendedSet.has(String(v)));

    return { recommended, other };
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.danger(
        "Not allowed",
        "You don’t have permission to modify this Doc.",
      );
      return;
    }
    if (!title.trim()) {
      toast.warning("Missing title", "Title is required.");
      return;
    }
    if ((mode === "create" || mode === "replace") && !mediaId) {
      toast.warning(
        "Missing file",
        "Select a Vault file (document or image) to attach.",
      );
      return;
    }

    const trimmedCustomSubcategory = customSubcategory.trim();
    const isCustom = String(subcategory) === "CUSTOM";
    if (mode !== "replace" && isCustom) {
      if (!trimmedCustomSubcategory) {
        toast.warning(
          "Missing subcategory",
          "Enter a custom subcategory name (required when Subcategory is Custom).",
        );
        return;
      }
      if (trimmedCustomSubcategory.length > 80) {
        toast.warning(
          "Subcategory too long",
          "Custom subcategory must be 80 characters or less.",
        );
        return;
      }
    }

    if (mode === "create" || mode === "replace") {
      // Defensive: API only allows DOCUMENT or PHOTO vault objects for Life Docs.
      const media =
        selectedMedia ?? (mediaId ? await mediaApi.get(mediaId) : null);
      if (!media) {
        toast.warning(
          "Missing file",
          "Select a Vault file (document or image) to attach.",
        );
        return;
      }
      if (media.type !== "DOCUMENT" && media.type !== "PHOTO") {
        toast.warning(
          "Unsupported file",
          "Life Docs supports Vault documents (PDF, etc) or images (scans/photos).",
        );
        return;
      }

      // Integrity: Life Docs require sha256Ciphertext to prevent tampering.
      if (!media.sha256Ciphertext) {
        toast.warning(
          "Re-upload required",
          "This document was uploaded without an integrity hash. Please re-upload it (or upload a new document) and try again.",
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "create") {
        const created = await lifeDocsApi.create({
          mediaId,
          category,
          subcategory,
          ...(isCustom ? { customSubcategory: trimmedCustomSubcategory } : {}),
          title: title.trim(),
          issuingAuthority: issuingAuthority.trim() || undefined,
          issueDate: issueDate || undefined,
          expiryDate: expiryDate || undefined,
          renewalRequired,
          reminderSetting,
          visibility,
        });
        toast.success("Created", "Life Doc created.");
        navigate(`/apps/life-docs/${created.id}`);
        return;
      }

      if (!id) throw new Error("Missing id");

      if (mode === "replace") {
        const replaced = await lifeDocsApi.replace(id, {
          mediaId,
          title: title.trim() || undefined,
          issuingAuthority: issuingAuthority.trim() || undefined,
          issueDate: issueDate || undefined,
          expiryDate: expiryDate || undefined,
          reminderSetting,
          visibility,
        } as any);
        toast.success("Replaced", "New version created.");
        navigate(`/apps/life-docs/${replaced.id}`);
        return;
      }

      const updated = await lifeDocsApi.update(id, {
        category,
        subcategory,
        ...(isCustom ? { customSubcategory: trimmedCustomSubcategory } : {}),
        title: title.trim(),
        issuingAuthority: issuingAuthority.trim() || undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        renewalRequired,
        reminderSetting,
        visibility,
      });

      toast.success("Saved", "Life Doc updated.");
      navigate(`/apps/life-docs/${updated.id}`);
    } catch (e: any) {
      toast.danger("Save failed", e?.message || "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMediaPick = (ids: string[]) => {
    const pickedId = ids[0];
    if (pickedId) {
      setMediaId(pickedId);
      setSelectedMedia(null); // Will trigger reload in effect
      setMediaPickerOpen(false);
    }
  };

  if (isLoading) return <Loading message="Loading..." />;

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#FF3B30" }}>
        <h3>Error</h3>
        <p>{error}</p>
        <Link to="/apps/life-docs" style={{ color: "#007AFF" }}>
          Go Back
        </Link>
      </div>
    );
  }

  const pageTitle =
    mode === "create"
      ? "New Life Doc"
      : mode === "replace"
        ? "Replace Document"
        : "Edit Metadata";

  return (
    <div
      className="lifeDocsPage lifeDocsPage--narrow"
      style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-16)" }}
    >
      {/* Header */}
      <div
        className="lifeDocsHero lifeDocsHero--compact"
        style={{ marginBottom: "var(--space-8)" }}
      >
        <div className="lifeDocsHeroInner">
          <div>
            <h1
              className="lifeDocsHeroTitle"
              style={{ margin: 0, fontSize: "2.25rem" }}
            >
              {pageTitle}
            </h1>
          </div>
          <div className="lifeDocsHeroActions">
            <Link
              to={baseDoc ? `/apps/life-docs/${baseDoc.id}` : "/apps/life-docs"}
              className="btn btn-ghost"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Document Selection (Create/Replace only) */}
        {(mode === "create" || mode === "replace") && (
          <div style={{ marginBottom: "var(--space-10)" }}>
            <SectionHeader title="Document" />
            <div
              onClick={() => setMediaPickerOpen(true)}
              className="lifeDocsDropzone"
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "12px",
                  background: mediaId ? "#007AFF" : "var(--bg-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: mediaId ? "#000" : "var(--text-secondary)",
                }}
              >
                {mediaId ? <CheckIcon size={24} /> : <CloudIcon size={24} />}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  {selectedMedia
                    ? selectedMedia.title || selectedMedia.originalFilename
                    : "Select from Vault"}
                </div>
                <div
                  style={{ color: "var(--text-secondary)", fontSize: "14px" }}
                >
                  {selectedMedia
                    ? "Document attached"
                    : "Choose a file from your encrypted library"}
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm">
                {mediaId ? "Change" : "Select"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadDialogOpen(true);
                }}
                className="btn btn-secondary btn-sm"
              >
                Upload
              </button>
            </div>
          </div>
        )}
        {/* Category + Subcategory */}
        {isMetaEditable && (
          <div style={{ marginBottom: "var(--space-10)" }}>
            <SectionHeader title="Category" />
            <div className="lifeDocsCategoryGrid">
              {Object.entries(CATEGORY_THEMES).map(([catKey, theme]) => {
                const typedKey = catKey as LifeDocCategory;
                const isActive = category === typedKey;
                const Icon = theme.icon;

                return (
                  <div
                    key={catKey}
                    onClick={() => setCategory(typedKey)}
                    className={`lifeDocsCategoryCard${isActive ? " lifeDocsCategoryCard--active" : ""}`}
                    style={{
                      background: isActive ? theme.bg : undefined,
                      borderColor: isActive ? theme.color : undefined,
                    }}
                  >
                    <div
                      style={{
                        color: isActive ? theme.color : "var(--text-secondary)",
                      }}
                    >
                      <Icon size={28} />
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textAlign: "center",
                        color: isActive ? theme.color : "var(--text-secondary)",
                        lineHeight: 1.2,
                      }}
                    >
                      {theme.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "18px" }}>
              <SectionHeader title="Subcategory" />
              <div
                className="card"
                style={{ background: "var(--bg-secondary)", boxShadow: "none" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700 }}>
                      Subcategory
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Pick a suggested type or choose Custom.
                    </div>
                  </div>

                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value as any)}
                    className="form-select"
                    style={{
                      minWidth: "240px",
                      flex: "1 1 240px",
                      maxWidth: "360px",
                    }}
                  >
                    <optgroup label="Recommended">
                      {subcategoryOptions.recommended.map((v) => (
                        <option key={String(v)} value={v}>
                          {subcategoryLabel(v)}
                        </option>
                      ))}
                    </optgroup>
                    {subcategoryOptions.other.length > 0 && (
                      <optgroup label="Other">
                        {subcategoryOptions.other.map((v) => (
                          <option key={String(v)} value={v}>
                            {subcategoryLabel(v)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Custom">
                      <option value={LifeDocSubcategoryEnum.CUSTOM}>
                        Custom…
                      </option>
                    </optgroup>
                  </select>
                </div>

                {String(subcategory) === "CUSTOM" && (
                  <div style={{ marginTop: "14px" }}>
                    <InputField
                      label="Custom subcategory"
                      value={customSubcategory}
                      onChange={(e: any) =>
                        setCustomSubcategory(e.target.value)
                      }
                      placeholder="e.g. Vehicle Registration"
                      required
                    />
                    <div
                      style={{
                        marginTop: "-10px",
                        color: "var(--text-tertiary)",
                        fontSize: "13px",
                      }}
                    >
                      This name is stored with the document and used in
                      reminders.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div style={{ marginBottom: "32px" }}>
          <SectionHeader title="Details" />
          <InputField
            label="Title"
            value={title}
            onChange={(e: any) => setTitle(e.target.value)}
            placeholder="e.g. US Passport"
            required
          />
          <InputField
            label="Issuing Authority"
            value={issuingAuthority}
            onChange={(e: any) => setIssuingAuthority(e.target.value)}
            placeholder="e.g. Department of State"
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            <div className="form-group">
              <label className="form-label">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="form-input"
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onKeyDown={(e) => e.preventDefault()}
                style={{ cursor: "pointer" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="form-input"
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onKeyDown={(e) => e.preventDefault()}
                style={{ cursor: "pointer" }}
              />
            </div>
          </div>
        </div>

        {/* Settings */}
        <div style={{ marginBottom: "40px" }}>
          <SectionHeader title="Settings" />
          <div
            className="card"
            style={{ background: "var(--bg-secondary)", boxShadow: "none" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600 }}>
                  Visibility
                </div>
                <div
                  style={{ fontSize: "13px", color: "var(--text-secondary)" }}
                >
                  Who can see this document?
                </div>
              </div>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="form-select"
                style={{ maxWidth: 240 }}
              >
                {Object.values(LifeDocVisibilityEnum).map((v) => (
                  <option key={v} value={v}>
                    {visibilityLabel(v)}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: "15px", fontWeight: 600 }}>
                  Renewal Reminder
                </div>
                <div
                  style={{ fontSize: "13px", color: "var(--text-secondary)" }}
                >
                  When should we notify you?
                </div>
              </div>
              <select
                value={reminderSetting}
                onChange={(e) => setReminderSetting(e.target.value as any)}
                className="form-select"
                style={{ maxWidth: 240 }}
              >
                {Object.values(LifeDocReminderSettingEnum).map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, " ").toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary btn-lg"
          style={{
            width: "100%",
            marginBottom: "40px",
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting
            ? "Saving..."
            : mode === "create"
              ? "Create Life Doc"
              : "Save Changes"}
        </button>
      </form>

      <MediaPickerModal
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onConfirm={handleMediaPick}
        title="Select Vault File"
        message="Choose a document (PDF, etc) or image (scan/photo) from your encrypted library"
        limit={50}
        filter={(m) =>
          (m.type === "DOCUMENT" || m.type === "PHOTO") && !m.isTrashed
        }
        emptyMessage="No files found. If items don’t appear, make sure your Vault is unlocked and try uploading a new PDF or image."
        tabs={[
          { key: "images", label: "Images", filter: (m) => m.type === "PHOTO" },
          {
            key: "docs",
            label: "Documents",
            filter: (m) => m.type === "DOCUMENT",
          },
        ]}
        defaultTabKey="images"
      />

      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={async () => {
          setUploadDialogOpen(false);
          toast.success("Uploaded", "Your file is now in the Vault.");

          // Best-effort: auto-select the most recently created eligible item.
          try {
            const res = await mediaApi.list({ limit: 10 });
            const newest = (res.items || []).find(
              (m) =>
                (m.type === "DOCUMENT" || m.type === "PHOTO") &&
                !m.isTrashed &&
                !!m.sha256Ciphertext,
            );
            if (newest?.id) {
              setMediaId(newest.id);
              setSelectedMedia(newest);
            }
          } catch {
            // ignore
          }
        }}
        onNeedUnlock={() => {
          setUploadDialogOpen(false);
          setNeedUnlockModalOpen(true);
        }}
      />

      <VaultUnlockModal
        open={needUnlockModalOpen}
        onClose={() => setNeedUnlockModalOpen(false)}
        onUnlockSuccess={() => {
          setNeedUnlockModalOpen(false);
          setUploadDialogOpen(true);
        }}
        title="Unlock Vault"
        message="Enter your vault password to upload and attach files."
      />
    </div>
  );
};
