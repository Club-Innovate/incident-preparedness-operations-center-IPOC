using Microsoft.Extensions.Configuration;

/*
File: IPOC_WEB.AppHost/AppHost.cs
Blueprint Name: AppHost

-------------------------------------------------------------------
Author: Hans Esquivel
Created: 2025-06-27
Updated: 2026-07-12

Description:
Aspire application host composition root for IPOC_WEB.
Wires cache, server, and frontend resources with endpoint configuration.

Features:
  - Distributed application orchestration with Aspire.
  - Resource dependency wiring and startup ordering.
  - Frontend/server endpoint exposure for local operations.

Security & Compliance:
  - Uses platform-managed service wiring with least-privilege design intent.
  - Avoids embedding secrets in source-controlled host composition.
  - Supports operational visibility through Aspire-managed resource model.
*/

var builder = DistributedApplication.CreateBuilder(args);

var useRedis = builder.Configuration.GetValue("Cache:UseRedis", false);

var server = builder.AddProject<Projects.IPOC_WEB_Server>("server")
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

if (useRedis)
{
    var cache = builder.AddRedis("cache");
    server = server
        .WithReference(cache)
        .WaitFor(cache);
}

var webfrontend = builder.AddViteApp("webfrontend", "../frontend")
    .WithReference(server)
    .WaitFor(server)
    .WithHttpsEndpoint(port: 51009, name: "https", env: "PORT");

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
