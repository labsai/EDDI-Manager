import { describe, it, expect } from "vitest";
import { screen, waitFor, fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "sonner";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderPage } from "@/test/test-utils";
import { ResourceDetailPage } from "@/pages/resource-detail";

function renderRagPage(id = "res1") {
  return renderPage(
    `/manage/resources/rag/${id}`,
    <ResourceDetailPage />,
    "/manage/resources/:type/:id"
  );
}

describe("RAG Knowledge Base Editor", () => {
  // ─── Rendering / Data Population ──────────────────────────

  it("renders rag form editor", async () => {
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("rag-editor")).toBeInTheDocument();
    });
  });

  it("renders form tab as default when editor exists", async () => {
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("form-view")).toBeInTheDocument();
    });
  });

  it("renders KB name input from mock data", async () => {
    renderRagPage();
    await waitFor(() => {
      const input = screen.getByTestId("kb-name") as HTMLInputElement;
      expect(input.value).toBe("product-docs");
    });
  });

  it("renders embedding provider dropdown from mock data", async () => {
    renderRagPage();
    await waitFor(() => {
      const select = screen.getByTestId("embedding-provider") as HTMLSelectElement;
      expect(select.value).toBe("openai");
    });
  });

  it("renders all 8 embedding providers in dropdown", async () => {
    renderRagPage();
    await waitFor(() => {
      const select = screen.getByTestId("embedding-provider") as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.value);
      expect(options).toEqual([
        "openai",
        "azure-openai",
        "ollama",
        "mistral",
        "bedrock",
        "cohere",
        "vertex",
        "gemini",
      ]);
    });
  });

  it("renders vector store selection with pgvector selected", async () => {
    renderRagPage();
    await waitFor(() => {
      const pgBtn = screen.getByTestId("store-pgvector");
      expect(pgBtn).toBeInTheDocument();
      expect(pgBtn.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("renders max results slider with mock value", async () => {
    renderRagPage();
    await waitFor(() => {
      const slider = screen.getByTestId("max-results") as HTMLInputElement;
      expect(slider.value).toBe("5");
    });
  });

  it("renders min score slider with mock value", async () => {
    renderRagPage();
    await waitFor(() => {
      const slider = screen.getByTestId("min-score") as HTMLInputElement;
      expect(slider.value).toBe("0.6");
    });
  });

  it("renders all five store type buttons", async () => {
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("store-in-memory")).toBeInTheDocument();
      expect(screen.getByTestId("store-pgvector")).toBeInTheDocument();
      expect(screen.getByTestId("store-mongodb-atlas")).toBeInTheDocument();
      expect(screen.getByTestId("store-elasticsearch")).toBeInTheDocument();
      expect(screen.getByTestId("store-qdrant")).toBeInTheDocument();
    });
  });

  // ─── Interaction Tests ────────────────────────────────────

  it("marks dirty when KB name is changed", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("kb-name")).toBeInTheDocument();
    });

    const input = screen.getByTestId("kb-name");
    await user.clear(input);
    await user.type(input, "my-new-kb");

    await waitFor(() => {
      expect(screen.getByTestId("dirty-indicator")).toBeInTheDocument();
    });
  });

  it("switches embedding provider via dropdown", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("embedding-provider")).toBeInTheDocument();
    });

    const select = screen.getByTestId("embedding-provider") as HTMLSelectElement;
    await user.selectOptions(select, "mistral");

    await waitFor(() => {
      expect(select.value).toBe("mistral");
    });
  });

  it("switches to azure-openai provider", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("embedding-provider")).toBeInTheDocument();
    });

    const select = screen.getByTestId("embedding-provider") as HTMLSelectElement;
    await user.selectOptions(select, "azure-openai");

    await waitFor(() => {
      expect(select.value).toBe("azure-openai");
    });
  });

  it("switches store type and highlights the new selection", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("store-pgvector")).toBeInTheDocument();
    });

    const qdrantBtn = screen.getByTestId("store-qdrant");
    await user.click(qdrantBtn);

    await waitFor(() => {
      expect(qdrantBtn.getAttribute("aria-pressed")).toBe("true");
      const pgBtn = screen.getByTestId("store-pgvector");
      expect(pgBtn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("switches to elasticsearch store", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("store-elasticsearch")).toBeInTheDocument();
    });

    const esBtn = screen.getByTestId("store-elasticsearch");
    await user.click(esBtn);

    await waitFor(() => {
      expect(esBtn.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("changes max results slider value", async () => {
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("max-results")).toBeInTheDocument();
    });

    const slider = screen.getByTestId("max-results") as HTMLInputElement;
    // Use fireEvent for range input (not user-initiated)
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "10" } });

    await waitFor(() => {
      expect(slider.value).toBe("10");
    });
  });

  it("changes min score slider value", async () => {
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("min-score")).toBeInTheDocument();
    });

    const slider = screen.getByTestId("min-score") as HTMLInputElement;
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "0.8" } });

    await waitFor(() => {
      expect(slider.value).toBe("0.8");
    });
  });

  // ─── Collapsed Section Expansion Tests ────────────────────

  it("expands chunking section to reveal chunk size slider", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("rag-editor")).toBeInTheDocument();
    });

    // Chunking section is collapsed by default
    expect(screen.queryByTestId("chunk-size")).not.toBeInTheDocument();

    // Find the chunking section header button and click it
    fireEvent.click(screen.getByTestId("section-chunking"));

    await waitFor(() => {
      const slider = screen.getByTestId("chunk-size") as HTMLInputElement;
      expect(slider.value).toBe("512");
    });
  });

  it("expands chunking section and validates overlap slider", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("rag-editor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("section-chunking"));

    await waitFor(() => {
      const slider = screen.getByTestId("chunk-overlap") as HTMLInputElement;
      expect(slider.value).toBe("64");
    });
  });

  it("changes chunk strategy from dropdown", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("rag-editor")).toBeInTheDocument();
    });

    // Expand chunking section
    fireEvent.click(screen.getByTestId("section-chunking"));

    await waitFor(() => {
      expect(screen.getByTestId("chunk-strategy")).toBeInTheDocument();
    });

    const select = screen.getByTestId("chunk-strategy") as HTMLSelectElement;
    await user.selectOptions(select, "sentence");

    await waitFor(() => {
      expect(select.value).toBe("sentence");
    });
  });

  // ─── JSON Tab Switch ──────────────────────────────────────

  it("switches to JSON tab and shows JSON view", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("tab-json")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("tab-json"));

    await waitFor(() => {
      expect(screen.getByTestId("json-view")).toBeInTheDocument();
    });
  });

  // ─── Coverage expansion tests ──────────────────────────────────

  it("switches to ollama embedding provider", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("embedding-provider")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId("embedding-provider"), "ollama");

    await waitFor(() => {
      expect((screen.getByTestId("embedding-provider") as HTMLSelectElement).value).toBe("ollama");
    });
  });

  it("switches to bedrock embedding provider", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("embedding-provider")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId("embedding-provider"), "bedrock");

    await waitFor(() => {
      expect((screen.getByTestId("embedding-provider") as HTMLSelectElement).value).toBe("bedrock");
    });
  });

  it("switches to gemini embedding provider", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("embedding-provider")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId("embedding-provider"), "gemini");

    await waitFor(() => {
      expect((screen.getByTestId("embedding-provider") as HTMLSelectElement).value).toBe("gemini");
    });
  });

  it("switches to in-memory store type", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("store-in-memory")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("store-in-memory"));

    await waitFor(() => {
      expect(screen.getByTestId("store-in-memory").getAttribute("aria-pressed")).toBe("true");
      expect(screen.getByTestId("store-pgvector").getAttribute("aria-pressed")).toBe("false");
    });
  });

  it("switches to mongodb-atlas store type", async () => {
    const user = userEvent.setup();
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByTestId("store-mongodb-atlas")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("store-mongodb-atlas"));

    await waitFor(() => {
      expect(screen.getByTestId("store-mongodb-atlas").getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("renders embedding parameters from mock data", async () => {
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("text-embedding-3-small")).toBeInTheDocument();
    });
  });

  it("renders store parameters from mock data", async () => {
    renderRagPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("localhost")).toBeInTheDocument();
    });
  });

  // ─── Ingestion Sources ─────────────────────────────────

  /** Helper: expand the "Ingestion Sources" section (collapsed by default) */
  async function expandIngestionSources() {
    await waitFor(() => {
      expect(screen.getByTestId("rag-editor")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("section-ingestion-sources"));
    await waitFor(() => {
      expect(screen.getByTestId("ingestion-sources-panel")).toBeInTheDocument();
    });
  }

  it("renders ingestion sources section when expanded", async () => {
    renderRagPage();
    await expandIngestionSources();
  });

  it("shows existing ingestion source from mock data", async () => {
    renderRagPage();
    await expandIngestionSources();
    await waitFor(() => {
      expect(screen.getByTestId("source-name-0")).toBeInTheDocument();
    });
    expect(screen.getByTestId("source-name-0")).toHaveTextContent("Product Documentation");
  });

  it("shows add ingestion source button when not read-only", async () => {
    renderRagPage();
    await expandIngestionSources();
    await waitFor(() => {
      expect(screen.getByTestId("add-ingestion-source-btn")).toBeInTheDocument();
    });
  });

  it("opens ingestion source editor form on add click", async () => {
    renderRagPage();
    await expandIngestionSources();
    fireEvent.click(screen.getByTestId("add-ingestion-source-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("ingestion-source-editor")).toBeInTheDocument();
    });
  });

  it("renders source type selection buttons", async () => {
    renderRagPage();
    await expandIngestionSources();
    fireEvent.click(screen.getByTestId("add-ingestion-source-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("source-type-web")).toBeInTheDocument();
      expect(screen.getByTestId("source-type-file")).toBeInTheDocument();
      expect(screen.getByTestId("source-type-git")).toBeInTheDocument();
      expect(screen.getByTestId("source-type-api")).toBeInTheDocument();
    });
  });

  it("web source type is selected by default", async () => {
    renderRagPage();
    await expandIngestionSources();
    fireEvent.click(screen.getByTestId("add-ingestion-source-btn"));
    await waitFor(() => {
      const webBtn = screen.getByTestId("source-type-web");
      expect(webBtn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("renders start url input when adding web source", async () => {
    renderRagPage();
    await expandIngestionSources();
    fireEvent.click(screen.getByTestId("add-ingestion-source-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("source-start-url")).toBeInTheDocument();
    });
  });

  it("renders cron preset buttons", async () => {
    renderRagPage();
    await expandIngestionSources();
    fireEvent.click(screen.getByTestId("add-ingestion-source-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("cron-preset-hourly")).toBeInTheDocument();
      expect(screen.getByTestId("cron-preset-daily")).toBeInTheDocument();
      expect(screen.getByTestId("cron-preset-weekly")).toBeInTheDocument();
      expect(screen.getByTestId("cron-preset-monthly")).toBeInTheDocument();
    });
  });

  it("shows edit and delete buttons on existing sources", async () => {
    renderRagPage();
    await expandIngestionSources();
    await waitFor(() => {
      expect(screen.getByTestId("source-item-0")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("source-edit-0")).toBeInTheDocument();
      expect(screen.getByTestId("source-delete-0")).toBeInTheDocument();
      expect(screen.getByTestId("source-trigger-0")).toBeInTheDocument();
    });
  });

  // ─── Error Handling ─────────────────────────────────────

  describe("error handling", () => {
    function renderPageWithToaster(type: string, id = "res1") {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      return render(
        <MemoryRouter initialEntries={[`/manage/resources/${type}/${id}`]}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="light" storageKey="eddi-theme-test">
              <Toaster />
              <Routes>
                <Route
                  path="/manage/resources/:type/:id"
                  element={<ResourceDetailPage />}
                />
              </Routes>
            </ThemeProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    it("shows error toast and keeps editor open when source creation fails", async () => {
      server.use(
        http.post("*/ragstore/ingestion-sources", () => {
          return HttpResponse.json(
            { message: "Internal Server Error" },
            { status: 500 },
          );
        }),
      );

      renderPageWithToaster("rag");

      // Expand ingestion sources section
      await waitFor(() => {
        expect(screen.getByTestId("rag-editor")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId("section-ingestion-sources"));
      await waitFor(() => {
        expect(screen.getByTestId("ingestion-sources-panel")).toBeInTheDocument();
      });

      // Open add form
      fireEvent.click(screen.getByTestId("add-ingestion-source-btn"));
      await waitFor(() => {
        expect(screen.getByTestId("ingestion-source-editor")).toBeInTheDocument();
      });

      // Fill in the name so save button is enabled
      const nameInput = screen.getByTestId("ingestion-source-name") as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "Test Source" } });

      // Click save
      fireEvent.click(screen.getByTestId("source-save-btn"));

      // Assert error toast is shown
      await waitFor(() => {
        expect(screen.getByText(/Failed to create ingestion source/)).toBeInTheDocument();
      });

      // The editor should remain open (not close on error)
      await waitFor(() => {
        expect(screen.getByTestId("ingestion-source-editor")).toBeInTheDocument();
      });
    });
  });
});
