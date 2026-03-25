export const PERMISSION_KEYS = {
  messaging: {
    textSend: "msg.text.send",
    voiceSend: "msg.voice.send",
    imageSend: "msg.image.send",
    videoSend: "msg.video.send",
    documentSend: "msg.document.send",
    linkSend: "msg.link.send",
    contactSend: "msg.contact.send",
    locationSend: "msg.location.send",
  },
  calling: {
    voiceStart: "call.voice.start",
    videoStart: "call.video.start",
    directRing: "call.direct.ring",
    schedule: "call.schedule",
  },
  mediaPrivacy: {
    protectedSend: "media.protected.send",
    download: "media.download",
    forward: "media.forward",
    export: "media.export",
    screenshot: "media.screenshot",
    screenRecord: "media.screen_record",
  },
  vault: {
    itemAttach: "vault.item.attach",
    itemView: "vault.item.view",
    itemDownload: "vault.item.download",
    itemRevoke: "vault.item.revoke",
    itemReshare: "vault.item.reshare",
    folderCreate: "vault.folder.create",
  },
  profile: {
    basicView: "profile.basic.view",
    fullView: "profile.full.view",
    phoneView: "profile.phone.view",
    emailView: "profile.email.view",
    statusView: "profile.status.view",
    lastSeenView: "profile.last_seen.view",
    availabilityView: "profile.availability.view",
  },
  actions: {
    bookingRequestCreate: "booking.request.create",
    paymentRequestCreate: "payment.request.create",
    paymentExecute: "payment.execute",
    invoiceIssue: "invoice.issue",
    supportTicketCreate: "support.ticket.create",
    approvalRequestCreate: "approval.request.create",
  },
  ai: {
    summaryUse: "ai.summary.use",
    replyUse: "ai.reply.use",
    extractActionsUse: "ai.extract_actions.use",
  },
  relationship: {
    promoteTrusted: "relationship.promote_trusted",
    demoteLimited: "relationship.demote_limited",
    block: "relationship.block",
    report: "relationship.report",
    mute: "relationship.mute",
  },
} as const;

type NestedPermissionKeyValues = {
  [Category in keyof typeof PERMISSION_KEYS]: (typeof PERMISSION_KEYS)[Category][keyof (typeof PERMISSION_KEYS)[Category]];
};

export type PermissionKey =
  NestedPermissionKeyValues[keyof NestedPermissionKeyValues];

export const ALL_PERMISSION_KEYS = Object.freeze(
  Object.values(PERMISSION_KEYS).flatMap((category) => Object.values(category)),
) as readonly PermissionKey[];
