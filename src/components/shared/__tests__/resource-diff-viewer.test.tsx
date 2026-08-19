import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceDiffViewer } from "@/components/agents/resource-diff-viewer";

function renderDiff(source: string | null, target: string | null) {
  return render(
    <ResourceDiffViewer sourceContent={source} targetContent={target} />
  );
}

describe("ResourceDiffViewer", () => {
  it("renders nothing when both contents are null", () => {
    const { container } = renderDiff(null, null);
    expect(container.innerHTML).toBe("");
  });

  it("shows 'Content identical' when source equals target", () => {
    renderDiff('{"key": "value"}', '{"key": "value"}');
    expect(screen.getByText("Content identical")).toBeInTheDocument();
  });

  it("shows 'Content identical' even with different key order (deep-sort)", () => {
    renderDiff(
      '{"b": 1, "a": 2}',
      '{"a": 2, "b": 1}'
    );
    expect(screen.getByText("Content identical")).toBeInTheDocument();
  });

  it("shows 'Content identical' with nested key reorder", () => {
    renderDiff(
      '{"outer": {"z": 1, "a": 2}}',
      '{"outer": {"a": 2, "z": 1}}'
    );
    expect(screen.getByText("Content identical")).toBeInTheDocument();
  });

  it("shows diff lines when content differs", () => {
    renderDiff(
      '{"key": "new-value"}',
      '{"key": "old-value"}'
    );
    // Should show + and − markers
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("−")).toBeInTheDocument();
  });

  it("handles malformed JSON gracefully (raw text diff)", () => {
    renderDiff("not { json", "also not json");
    // Should still render a diff without crashing
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("handles one side being null (entirely new content)", () => {
    renderDiff('{"new": true}', null);
    // All lines should be additions
    const additions = screen.getAllByText("+");
    expect(additions.length).toBeGreaterThan(0);
  });

  it("renders Target → Source header", () => {
    renderDiff('{"a": 1}', '{"a": 2}');
    expect(screen.getByText(/Target/)).toBeInTheDocument();
    expect(screen.getByText(/Source/)).toBeInTheDocument();
  });

  describe("normalisation", () => {
    it("treats a compact body and a pretty-printed one as identical", () => {
      // The operator approval diff compares a raw request body against a stored
      // document. Without normalising both, the entire document reads as
      // rewritten when only the whitespace differs.
      renderDiff('{"a":1,"b":{"c":2}}', '{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}');
      expect(screen.getByText("Content identical")).toBeInTheDocument();
    });

    // The shapes below are what EDDI's SecretRedactionFilter actually produces:
    // its generic rule matches `<name>":"<value>` — key's closing quote, colon
    // and the value's opening quote included — and writes `<name>=<REDACTED>`
    // over the lot. Verified by running the filter's rules over JSON bodies.
    it.each([
      ['{"modelName":"claude-sonnet-5","apiKey=<REDACTED>","threshold":9}', "a string value"],
      ['{"token=<REDACTED>,"threshold":9}', "a numeric value (no closing quote left)"],
      ['{"clientSecret=<REDACTED>","threshold":9}', "a key that merely ends in a filter name"],
      ['{"x-api-key=<REDACTED>","threshold":9}', "a hyphenated key"],
      ['{\n  "apiKey=<REDACTED>",\n  "threshold": 9\n}', "a pretty-printed body"],
      ['{"password=<REDACTED> more","threshold":9}', "a secret with a space in it"],
      ['{"llm":{"apiKey=<REDACTED>"},"threshold":9}', "a nested object"],
      ['{"apiKey=<REDACTED>","password=<REDACTED>","threshold":9}', "two redacted fields"],
    ])("still formats a body the redaction filter left unparseable — %s", (source) => {
      renderDiff(source, '{"apiKey":"stored","threshold":5}');

      // Parsed, so no raw-text caveat — and the threshold change is rendered
      // as a proper one-line change rather than a whole-document rewrite.
      expect(screen.queryByTestId("diff-raw-comparison")).not.toBeInTheDocument();
      expect(screen.getByText(/"threshold": 9/)).toBeInTheDocument();
      expect(screen.getByText(/"threshold": 5/)).toBeInTheDocument();
    });

    it("leaves a value that legitimately reads apiKey=<REDACTED> alone when repairing", () => {
      // `"note":"apiKey=abcdefghij"` redacts to a VALID string; only the mangled
      // key beside it triggers the repair, which must not touch the value.
      renderDiff('{"note":"apiKey=<REDACTED>","apiKey=<REDACTED>"}', '{"note":"x","apiKey":"stored"}');
      expect(screen.queryByTestId("diff-raw-comparison")).not.toBeInTheDocument();
      expect(screen.getByText(/"note": "apiKey=<REDACTED>"/)).toBeInTheDocument();
    });

    it("never rewrites a body that already parses", () => {
      // An escaped JSON document nested in a string carries the marker in
      // valid form; repairing it would corrupt the outer document.
      const nested = JSON.stringify({ requestBody: '{"apiKey=<REDACTED>"}' });
      renderDiff(nested, JSON.stringify({ requestBody: "{}" }));
      expect(screen.queryByTestId("diff-raw-comparison")).not.toBeInTheDocument();
      expect(screen.getByText(/apiKey=<REDACTED>/)).toBeInTheDocument();
    });

    it("says so when a side genuinely isn't JSON, rather than implying a rewrite", () => {
      renderDiff("not { json", '{"a": 1}');
      expect(screen.getByTestId("diff-raw-comparison")).toBeInTheDocument();
    });

    it("shows no caveat when both sides parse", () => {
      renderDiff('{"a": 1}', '{"a": 2}');
      expect(screen.queryByTestId("diff-raw-comparison")).not.toBeInTheDocument();
    });
  });

  describe("unchanged context", () => {
    const many = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`k${String(i).padStart(2, "0")}`, i]),
    );

    it("folds away long runs of unchanged lines", () => {
      renderDiff(JSON.stringify({ ...many, k00: 999 }), JSON.stringify(many));

      const gap = screen.getByTestId("diff-context-gap");
      expect(gap).toHaveTextContent(/unchanged lines/);
      expect(screen.queryByText(/k19/)).not.toBeInTheDocument();
      // The change itself and its immediate context stay visible.
      expect(screen.getByText(/"k00": 999/)).toBeInTheDocument();
      expect(screen.getByText(/"k01": 1/)).toBeInTheDocument();
    });

    it("expands a fold on click — nothing is hidden that can't be got back", async () => {
      renderDiff(JSON.stringify({ ...many, k00: 999 }), JSON.stringify(many));

      await userEvent.click(screen.getByTestId("diff-context-gap"));
      expect(screen.getByText(/k19/)).toBeInTheDocument();
      expect(screen.queryByTestId("diff-context-gap")).not.toBeInTheDocument();
    });

    it("does not fold a short run — the fold row would cost as much as it saves", () => {
      renderDiff('{"a": 1, "b": 2, "c": 3}', '{"a": 9, "b": 2, "c": 3}');
      expect(screen.queryByTestId("diff-context-gap")).not.toBeInTheDocument();
    });

    it("forgets expanded folds when the content changes — gap ids are positional", async () => {
      // The sync page re-previews into the same viewer instance. A fold opened
      // in the old diff must not pre-open whatever happens to be gap 0 in the new one.
      const { rerender } = renderDiff(JSON.stringify({ ...many, k00: 999 }), JSON.stringify(many));
      await userEvent.click(screen.getByTestId("diff-context-gap"));
      expect(screen.queryByTestId("diff-context-gap")).not.toBeInTheDocument();

      rerender(
        <ResourceDiffViewer
          sourceContent={JSON.stringify({ ...many, k19: 999 })}
          targetContent={JSON.stringify(many)}
        />,
      );
      expect(screen.getByTestId("diff-context-gap")).toBeInTheDocument();
    });
  });

  describe("legend", () => {
    it("names the sides by the caller's vocabulary when given", () => {
      render(
        <ResourceDiffViewer
          sourceContent='{"a": 1}'
          targetContent='{"a": 2}'
          labels={{ target: "Stored v3", source: "Proposed" }}
        />,
      );
      expect(screen.getByText("Stored v3")).toBeInTheDocument();
      expect(screen.getByText("Proposed")).toBeInTheDocument();
      expect(screen.queryByText(/Target/)).not.toBeInTheDocument();
    });
  });
});
