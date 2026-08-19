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

    it.each([
      ['{"apiKey":<REDACTED>","threshold":9}', "swallowed the opening quote"],
      ['{"apiKey":"<REDACTED>,"threshold":9}', "swallowed the closing quote"],
      ['{"apiKey":<REDACTED>,"threshold":9}', "swallowed both quotes"],
    ])("still formats a body whose redaction %#: %s", (source) => {
      renderDiff(source, '{"apiKey":"stored","threshold":5}');

      // Parsed, so no raw-text caveat — and the one real change is the only
      // context line rendered beside the credential.
      expect(screen.queryByTestId("diff-raw-comparison")).not.toBeInTheDocument();
      expect(screen.getByText(/"threshold": 9/)).toBeInTheDocument();
      expect(screen.getByText(/"threshold": 5/)).toBeInTheDocument();
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
  });
});
