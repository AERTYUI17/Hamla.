/**
 * Renders the campaign story: paragraphs, "## " headings and "- " lists.
 * Plain text only — no HTML from the database is ever injected.
 */
export function CampaignStory({ story }: { story: string }) {
  const blocks = story.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="story-prose">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return <h2 key={index}>{block.slice(3)}</h2>;
        }
        if (block.startsWith("### ")) {
          return <h3 key={index}>{block.slice(4)}</h3>;
        }
        if (block.split("\n").every((line) => line.trimStart().startsWith("- "))) {
          return (
            <ul key={index}>
              {block.split("\n").map((line, i) => (
                <li key={i}>{line.trimStart().slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block}</p>;
      })}
    </div>
  );
}
