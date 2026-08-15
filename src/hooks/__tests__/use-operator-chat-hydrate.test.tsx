import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  ConversationDescriptor,
  SimpleConversationMemorySnapshot,
} from "@/lib/api/conversations";

/**
 * Restoring an operator conversation across a navigation, a reload, and a
 * browser restart.
 *
 * The bug: the operator chat lived only in a module-level store, so navigating
 * away and back lost the transcript, and a browser restart lost the id too —
 * an investigation became unreachable while still running on the server.
 */
const h = vi.hoisted(() => ({
  /** Snapshots returned by getSimpleConversationLog, in call order. */
  logs: [] as Array<Partial<SimpleConversationMemorySnapshot>>,
  /** Thrown instead of the next snapshot, when set. */
  logError: null as unknown,
  descriptors: [] as ConversationDescriptor[],
  descriptorCalls: [] as Array<{ limit: number; agentId: string }>,
  logCalls: [] as Array<{ conversationId: string; returnCurrentStepOnly: boolean }>,
  /** Runs inside the snapshot read, before it resolves. */
  duringLogRead: null as null | (() => void),
}));

vi.mock("@/lib/api/chat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/chat")>();
  return {
    ...actual,
    startConversation: vi.fn(async () => "conv-new"),
    sendMessageStreaming: async function* () {
      yield { type: "done", data: JSON.stringify({ conversationState: "READY" }) };
    },
  };
});

vi.mock("@/lib/api/conversations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/conversations")>();
  return {
    ...actual,
    getSimpleConversationLog: vi.fn(
      async (conversationId: string, _detailed: boolean, returnCurrentStepOnly: boolean) => {
        h.logCalls.push({ conversationId, returnCurrentStepOnly });
        h.duringLogRead?.();
        if (h.logError) throw h.logError;
        const next = h.logs.shift();
        if (!next) throw new Error("test bug: ran out of mocked conversation logs");
        return next as SimpleConversationMemorySnapshot;
      },
    ),
    getConversationDescriptors: vi.fn(
      async (limit: number, _index: number, _filter: string, agentId: string) => {
        h.descriptorCalls.push({ limit, agentId });
        return h.descriptors;
      },
    ),
  };
});

import { useOperatorChat, useOperatorChatStore } from "../use-operator-chat";
import type { OperatorConfig } from "@/lib/api/operator";

function config(): OperatorConfig {
  return {
    enabled: true,
    agentId: "operator-agent",
    version: 1,
    environment: "production",
    provider: "anthropic",
    model: "claude-sonnet-5",
    credentialKey: null,
    scope: "read_write",
    authMode: "caller-identity",
    promptBody: "Do the thing.",
  };
}

/** A stored conversation step carrying the user's message. */
function step(input: string) {
  return { conversationStep: [{ key: "input:initial", value: input }] };
}

function textOutput(text: string) {
  return { output: [{ type: "text", text }] };
}

function descriptor(
  id: string,
  overrides: Partial<ConversationDescriptor> = {},
): ConversationDescriptor {
  return {
    resource: `eddi://ai.labs.conversation/conversationstore/conversations/${id}`,
    name: "",
    description: "",
    createdOn: 1000,
    lastModifiedOn: 1000,
    agentId: "operator-agent",
    agentVersion: 1,
    conversationState: "READY",
    ...overrides,
  };
}

/** A two-turn transcript. */
const TWO_TURNS: Partial<SimpleConversationMemorySnapshot> = {
  conversationState: "READY",
  conversationSteps: [step("what is deployed?"), step("and the logs?")],
  conversationOutputs: [textOutput("Three agents."), textOutput("All clean.")],
};

beforeEach(() => {
  h.logs = [];
  h.logError = null;
  h.descriptors = [];
  h.descriptorCalls = [];
  h.logCalls = [];
  h.duringLogRead = null;
  sessionStorage.clear();
  useOperatorChatStore.getState().reset();
});

/** Put a conversation id in storage the way a previous visit would have. */
function storeId(id: string) {
  sessionStorage.setItem("eddi.operator.conversationId", id);
  useOperatorChatStore.setState({ conversationId: id });
}

describe("hydrate: restoring the stored conversation", () => {
  it("rebuilds user and agent messages in transcript order", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "what is deployed?"],
      ["agent", "Three agents."],
      ["user", "and the logs?"],
      ["agent", "All clean."],
    ]);
    expect(result.current.conversationId).toBe("conv-1");
  });

  /**
   * In `returnCurrentStepOnly` mode the backend collapses conversationOutputs
   * to a single element, so every step would pair against the last turn's
   * answer. Reading the whole transcript is the entire point.
   */
  it("reads the WHOLE transcript, not just the current step", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(h.logCalls).toEqual([{ conversationId: "conv-1", returnCurrentStepOnly: false }]);
  });

  it("restores a paused conversation so the approval card comes back", async () => {
    storeId("conv-1");
    h.logs = [
      {
        conversationState: "AWAITING_HUMAN",
        hitlPauseReason: "Creating a new agent — review the whole config",
        hitlPausedAt: "2026-08-15T10:00:00Z",
        conversationSteps: [step("build me an agent")],
        conversationOutputs: [textOutput("I need your approval to run setupAgent.")],
      },
    ];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.pauseReason).toBe("Creating a new agent — review the whole config");
    // The ask bubble is what resolveApproval inserts the decision AFTER, so it
    // has to be the agent message, never the user's request above it.
    const ask = result.current.messages.find((m) => m.role === "agent");
    expect(result.current.pausedPlaceholderId).toBe(ask?.id);
  });

  it("leaves a READY conversation unpaused", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.isPaused).toBe(false);
    expect(result.current.pausedPlaceholderId).toBeNull();
  });

  /**
   * A conversation can be purged (`purgeEndedConversations`) or deleted with
   * the operator it belonged to. A stored id pointing at nothing must leave a
   * working empty chat, not a banner about a conversation nobody remembers.
   */
  it("clears the stored id on 404 and leaves an empty, usable chat", async () => {
    storeId("conv-gone");
    h.logError = Object.assign(new Error("Not Found"), { status: 404 });

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
    expect(result.current.error).toBeNull();
    expect(sessionStorage.getItem("eddi.operator.conversationId")).toBeNull();
  });

  it("surfaces a non-404 failure rather than pretending the chat is empty", async () => {
    storeId("conv-1");
    h.logError = Object.assign(new Error("Service Unavailable"), { status: 503 });

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.error).toBeTruthy();
    // The id survives: the conversation is probably fine, the backend is not.
    expect(sessionStorage.getItem("eddi.operator.conversationId")).toBe("conv-1");
  });
});

describe("hydrate: declining to do anything", () => {
  /**
   * The store is shared between the full page and the docked drawer, and both
   * call hydrate on mount. Without the in-flight latch the transcript would be
   * appended twice.
   */
  it("is a no-op while another hydrate is already in flight", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      // Two mounted surfaces, same tick — only one read may happen.
      await Promise.all([result.current.hydrate(), result.current.hydrate()]);
    });

    expect(h.logCalls).toHaveLength(1);
    expect(result.current.messages).toHaveLength(4);
  });

  it("never overwrites a transcript that is already on screen", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS];
    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    // A second mount later in the session must not re-read or re-append.
    await act(async () => {
      await result.current.hydrate();
    });

    expect(h.logCalls).toHaveLength(1);
    expect(result.current.messages).toHaveLength(4);
  });

  /**
   * A restore is slow; the admin does not wait for it and types. `send` puts
   * its optimistic bubbles up synchronously, so by the time the read resolves
   * the screen belongs to the new turn — and replacing it with a transcript
   * that predates the question would make the admin's own message vanish.
   *
   * Checked AFTER the read, not only before it: the pre-check cannot see a
   * send that had not happened yet when hydrate started.
   */
  it("yields to a turn the admin started while the read was in flight", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS];
    h.duringLogRead = () => {
      void useOperatorChatStore.getState().send(config(), "never mind, what about logs?");
    };

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.messages.some((m) => m.content === "never mind, what about logs?")).toBe(true);
    expect(result.current.messages.some((m) => m.content === "what is deployed?")).toBe(false);
  });

  it("does nothing when the operator is not configured", async () => {
    storeId("conv-1");

    const { result } = renderHook(() => useOperatorChat(null));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(h.logCalls).toEqual([]);
  });

  /**
   * `reset()` aborts the in-flight read. Without the abort check the resolved
   * transcript would land in the clean slate the user just asked for — and
   * re-raise a pause they had cleared.
   */
  it("discards a result whose hydrate was reset mid-flight", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS];
    h.duringLogRead = () => useOperatorChatStore.getState().reset();

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
  });
});

describe("hydrate: recovering after a browser restart", () => {
  /**
   * sessionStorage is gone after a restart, so there is no id to read. The
   * operator's newest still-usable conversation is looked up instead — which
   * keeps the storage tab-scoped (see CONVERSATION_STORAGE_KEY) and costs one
   * request.
   */
  it("finds the operator's newest conversation when nothing is stored", async () => {
    h.descriptors = [
      descriptor("conv-old", { lastModifiedOn: 1000 }),
      descriptor("conv-newest", { lastModifiedOn: 5000 }),
      descriptor("conv-middle", { lastModifiedOn: 3000 }),
    ];
    h.logs = [TWO_TURNS];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(h.descriptorCalls).toEqual([{ limit: 20, agentId: "operator-agent" }]);
    expect(result.current.conversationId).toBe("conv-newest");
    expect(sessionStorage.getItem("eddi.operator.conversationId")).toBe("conv-newest");
  });

  /**
   * Picked from the page rather than trusting position 0: the descriptor
   * endpoint's sort is a per-filter backend setting, not a newest-first
   * contract, and resuming the OLDEST conversation is a bug nobody reports
   * precisely.
   */
  it("picks by timestamp, not by the order the backend happened to return", async () => {
    h.descriptors = [
      descriptor("conv-newest", { lastModifiedOn: 9000 }),
      descriptor("conv-old", { lastModifiedOn: 10 }),
    ];
    h.logs = [TWO_TURNS];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.conversationId).toBe("conv-newest");
  });

  /**
   * Deactivating the operator ends every active conversation
   * (`endAllActiveConversations`), so after a deactivate/reactivate cycle the
   * newest conversation is always a dead one. Restoring it would show a
   * transcript whose composer fails on the next message.
   */
  it("skips ENDED conversations", async () => {
    h.descriptors = [
      descriptor("conv-dead", { lastModifiedOn: 9000, conversationState: "ENDED" }),
      descriptor("conv-live", { lastModifiedOn: 100 }),
    ];
    h.logs = [TWO_TURNS];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.conversationId).toBe("conv-live");
  });

  it("starts clean when the operator has no usable conversation at all", async () => {
    h.descriptors = [descriptor("conv-dead", { conversationState: "ENDED" })];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });

    expect(result.current.conversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(h.logCalls).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

describe("selectConversation: the History tab's row click", () => {
  it("replaces what is on screen with the picked conversation", async () => {
    storeId("conv-1");
    h.logs = [TWO_TURNS, { conversationState: "READY", conversationSteps: [step("older question")], conversationOutputs: [textOutput("older answer")] }];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.hydrate();
    });
    expect(result.current.messages).toHaveLength(4);

    await act(async () => {
      await result.current.selectConversation("conv-older");
    });

    expect(result.current.conversationId).toBe("conv-older");
    expect(result.current.messages.map((m) => m.content)).toEqual(["older question", "older answer"]);
    expect(sessionStorage.getItem("eddi.operator.conversationId")).toBe("conv-older");
  });

  it("restores the pause so a paused conversation can be decided from history", async () => {
    h.logs = [
      {
        conversationState: "AWAITING_HUMAN",
        hitlPauseReason: "Deploying agent-9",
        conversationSteps: [step("deploy it")],
        conversationOutputs: [textOutput("I need approval to deploy.")],
      },
    ];

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.selectConversation("conv-paused");
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.pauseReason).toBe("Deploying agent-9");
  });

  /**
   * The admin clicked a row the list said existed. Silently showing an empty
   * chat would read as "this conversation was empty" rather than "it is gone".
   */
  it("reports a failure rather than showing an empty chat", async () => {
    h.logError = Object.assign(new Error("Not Found"), { status: 404 });

    const { result } = renderHook(() => useOperatorChat(config()));
    await act(async () => {
      await result.current.selectConversation("conv-gone");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.conversationId).toBeNull();
    expect(result.current.messages).toEqual([]);
  });
});
