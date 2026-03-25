import {
  Briefcase,
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  MessageCircle,
  Send,
  Youtube,
} from "lucide-react";

import type { ResolvedPersonaSocialLink } from "@/lib/persona/social-links";

interface SocialLinkIconProps {
  platform: ResolvedPersonaSocialLink["platform"];
  className?: string;
}

export function SocialLinkIcon({ platform, className }: SocialLinkIconProps) {
  switch (platform) {
    case "linkedin":
      return <Linkedin className={className} />;
    case "instagram":
      return <Instagram className={className} />;
    case "github":
      return <Github className={className} />;
    case "youtube":
      return <Youtube className={className} />;
    case "facebook":
      return <Facebook className={className} />;
    case "telegram":
      return <Send className={className} />;
    case "whatsapp":
      return <MessageCircle className={className} />;
    case "threads":
    case "tiktok":
    case "x":
      return <Briefcase className={className} />;
    case "website":
      return <Globe className={className} />;
  }
}
