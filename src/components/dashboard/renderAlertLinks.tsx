import React from "react";

// Render an alert message with any embedded URLs (e.g. the SOS map link) as
// clickable anchors instead of plain text. Shared by the Command Center and
// Police alert feeds.
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

export const renderMessageWithLinks = (message: string): React.ReactNode => {
  const parts = message.split(URL_PATTERN);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="text-sky-400 underline underline-offset-2 hover:text-sky-300 break-all"
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );
};
