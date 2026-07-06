// Teste unitário do endpoint HTTP de health check (GET /health).
//
// Ver AGENTS.md > Coding Standards > "Testes": todo endpoint HTTP novo DEVE ter teste
// unitário cobrindo pelo menos o caminho feliz e um caminho de erro de validação, em
// tests/unit/. Este endpoint foi gerado por um agente isolado como sonda de conformidade
// da skill skills/domain/azure-functions-endpoint.md (Ex. 2.3) — ver
// .specs/features/azure-functions-endpoint-skill/evidence/. Cobre: checagem rasa (200),
// checagem profunda com falha de dependência (503, mapeada via `instanceof`
// DependencyUnavailableError — ver Regra 6/exemplo 3 da skill) e erro de validação (400).

import { describe, expect, it, vi } from "vitest";
import { HttpRequest, InvocationContext } from "@azure/functions";
import { healthHandler } from "../../src/functions/health/handler";
import { logger } from "../../src/shared/logger";

function buildRequest(query: Record<string, string> = {}): HttpRequest {
  return new HttpRequest({
    method: "GET",
    url: "http://localhost:7071/api/health",
    query,
  });
}

function buildContext(): InvocationContext {
  return new InvocationContext({
    invocationId: "test-invocation-id",
    functionName: "health",
  });
}

describe("healthHandler", () => {
  it("retorna 200 com checagem rasa quando nenhum query param é enviado", async () => {
    const response = await healthHandler(buildRequest(), buildContext());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ status: "ok" });
  });

  it("retorna 200 com checagem rasa quando deep=false", async () => {
    const response = await healthHandler(buildRequest({ deep: "false" }), buildContext());

    expect(response.status).toBe(200);
    expect(response.jsonBody).toEqual({ status: "ok" });
  });

  it("retorna 503 e loga a dependência que falhou quando deep=true (azure-openai é forçada a falhar)", async () => {
    const errorSpy = vi.spyOn(logger, "error");

    const response = await healthHandler(buildRequest({ deep: "true" }), buildContext());

    expect(response.status).toBe(503);
    const jsonBody = response.jsonBody as { error: string; dependency: string };
    expect(jsonBody.error).toBe("dependency_unavailable");
    expect(jsonBody.dependency).toBe("azure-openai");

    // Regra 6 da skill: erro pós-validação DEVE ser mapeado via classe customizada
    // (instanceof), com log estruturado — não apenas um 503 solto sem contexto.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ dependency: "azure-openai" }),
      expect.any(String)
    );

    errorSpy.mockRestore();
  });

  it("retorna 400 com detalhes de validação quando deep tem um valor fora do enum esperado", async () => {
    const response = await healthHandler(buildRequest({ deep: "yes" }), buildContext());

    expect(response.status).toBe(400);
    const jsonBody = response.jsonBody as {
      error: string;
      details: { fieldErrors: Record<string, string[] | undefined> };
    };
    expect(jsonBody.error).toBe("invalid_input");
    expect(jsonBody.details.fieldErrors.deep).toBeDefined();
  });
});
