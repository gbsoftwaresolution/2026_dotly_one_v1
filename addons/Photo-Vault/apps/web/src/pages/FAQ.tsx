import { useState } from "react";
import { Link } from "react-router-dom";
import { MarketingHeader } from "../components/MarketingHeader";
import { MarketingFooter } from "../components/MarketingFooter";
import { ChevronDownIcon } from "../components/icons";

const FAQItem = ({
  question,
  answer,
  isOpen,
  onClick,
}: {
  question: string;
  answer: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      style={{
        marginBottom: "var(--space-4)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-elevated)",
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      <button
        onClick={onClick}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {question}
        </h3>
        <div
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            color: "var(--text-secondary)",
          }}
        >
          <ChevronDownIcon size={24} />
        </div>
      </button>

      <div
        style={{
          maxHeight: isOpen ? "1000px" : "0",
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div
          style={{
            padding: "0 24px 24px 24px",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            fontSize: "1.05rem",
          }}
        >
          {answer}
        </div>
      </div>
    </div>
  );
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Can you really not see my photos?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>No. We cannot see them.</p>
          <p style={{ marginBottom: "16px" }}>
            Your photos are encrypted on your device before upload. We receive
            scrambled data. We do not have the decryption keys. We cannot
            unscramble the data.
          </p>
          <p>
            This is not a policy we could change. It is how the system is built.
            Even if we wanted to see your photos, we could not.
          </p>
        </>
      ),
    },
    {
      question: "How do I know you are telling the truth?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>
            You should not trust us blindly.
          </p>
          <p style={{ marginBottom: "16px" }}>
            The encryption happens in your browser using the{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              Web Crypto API
            </strong>
            . You can inspect the JavaScript code that runs in your browser.
            Security researchers can audit it.
          </p>
          <p style={{ marginBottom: "16px" }}>
            If we were secretly uploading unencrypted files or sending your
            encryption keys to our servers, someone would notice. The code is
            visible.
          </p>
          <p>
            We encourage technical users to verify our claims. Do not trust.
            Verify.
          </p>
        </>
      ),
    },
    {
      question: "What if the government demands my photos?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>
            We can only provide what we have. We have encrypted files and
            metadata.
          </p>
          <p style={{ marginBottom: "16px" }}>
            If law enforcement presents a valid legal request, we will comply
            with the law. We will provide your email address, subscription
            information, and any plaintext metadata (like filenames) you added.
          </p>
          <p style={{ marginBottom: "16px" }}>
            We cannot provide your photos because they are encrypted. We cannot
            provide your encryption keys because we do not have them.
          </p>
          <p>
            If authorities have your password, they can decrypt your files. But
            they would need to get your password from you, not from us.
          </p>
        </>
      ),
    },
    {
      question: "What if you get hacked?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>
            Hackers would get encrypted files.
          </p>
          <p style={{ marginBottom: "16px" }}>
            Without your password, encrypted files are useless. A data breach
            would expose scrambled data, not readable photos.
          </p>
          <p>
            This does not mean you should be careless. You should still use a
            strong password. You should still enable two-factor authentication
            if we offer it. But the damage from a breach is limited.
          </p>
        </>
      ),
    },
    {
      question: "Can your employees see my photos?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>No. Even if they tried.</p>
          <p style={{ marginBottom: "16px" }}>
            Employees have access to production systems for maintenance and
            support. But they cannot decrypt your files. They do not have your
            encryption keys.
          </p>
          <p style={{ marginBottom: "16px" }}>
            Employees could see metadata you provide. Filenames, dates, album
            names. If you include sensitive information in metadata, employees
            could see it.
          </p>
          <p>
            But your actual photos and videos remain encrypted and invisible.
          </p>
        </>
      ),
    },
    {
      question: "What happens if BoosterAi.me shuts down?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>
            You can export your data before we shut down.
          </p>
          <p style={{ marginBottom: "16px" }}>
            If we go out of business, we will give users advance notice. You can
            export everything and move to another service.
          </p>
          <p style={{ marginBottom: "16px" }}>
            Your exported data includes encrypted files. You will need your
            password to decrypt them. The encryption is not proprietary. Other
            tools can decrypt standard{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              XChaCha20-Poly1305
            </strong>{" "}
            encryption.
          </p>
          <p>This is why data export is important. Use it regularly.</p>
        </>
      ),
    },
    {
      question: "Do you track me across the web?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>No.</p>
          <p style={{ marginBottom: "16px" }}>
            We do not use analytics that phone home to third parties. No Google
            Analytics. No Facebook Pixel. No ad trackers.
          </p>
          <p>
            We log activity within BoosterAi.me to maintain the service. But we
            do not track where you came from or where you go after you leave.
          </p>
        </>
      ),
    },
    {
      question: "Do you sell my data?",
      answer: (
        <>
          <p style={{ marginBottom: "16px" }}>
            No. We cannot sell what we do not have.
          </p>
          <p style={{ marginBottom: "16px" }}>
            We cannot see your photos. We cannot sell them. We have no profile
            data to sell to advertisers. We do not run ads.
          </p>
          <p>
            We make money from subscriptions. That is our only revenue source.
          </p>
        </>
      ),
    },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
      <MarketingHeader />

      {/* ================= HERO SECTION ================= */}
      <section
        style={{
          padding: "var(--space-20) var(--space-6) var(--space-12)",
          textAlign: "center",
        }}
      >
        <h1
          className="animate-slide-up"
          style={{
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            fontWeight: 800,
            marginBottom: "var(--space-6)",
          }}
        >
          Frequently Asked Questions
        </h1>
        <p
          className="animate-slide-up"
          style={{
            fontSize: "1.25rem",
            color: "var(--text-secondary)",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: 1.6,
            animationDelay: "100ms",
          }}
        >
          Straight answers about privacy, encryption, and how we treat your
          data.
        </p>
      </section>

      {/* ================= FAQ LIST ================= */}
      <section style={{ padding: "0 var(--space-6) var(--space-32)" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section
        style={{
          padding: "var(--space-24) var(--space-6)",
          borderTop: "1px solid var(--border-primary)",
          background: "var(--bg-secondary)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "2rem", marginBottom: "var(--space-6)" }}>
            Still have questions?
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "var(--space-8)",
              fontSize: "1.1rem",
            }}
          >
            We believe in total transparency. If something isn't clear, ask us.
          </p>
          <div
            style={{ display: "flex", gap: "16px", justifyContent: "center" }}
          >
            <Link
              to="/how-encryption-works"
              className="btn btn-secondary"
              style={{
                padding: "12px 24px",
                borderRadius: "var(--radius-full)",
              }}
            >
              Read Technical Specs
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
