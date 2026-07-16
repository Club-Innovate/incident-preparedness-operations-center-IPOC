# Azure AI Search Service: IAM & Managed Identity Requirements Guide

When deploying a new Azure AI Search Service, following security best practices means minimizing the use of API keys and leveraging Microsoft Entra ID (formerly Azure AD) and Managed Identities for role-based access control (RBAC).

This document outlines the standard Managed Identities and Role Assignments required for a fully functional, secure Azure AI Search implementation.

---

## 1. Managed Identity Requirements

To allow your new Azure AI Search Service to securely access data sources (like Blob Storage or Azure SQL) and skillsets (like Azure OpenAI or AI Services) without storing passwords, you must enable a **System-Assigned Managed Identity** for the Search Service.

**What is it?**
An identity in Microsoft Entra tied directly to the lifecycle of your Search Service instance.

---

## 2. Required Role Assignments

### A. Roles the Search Service Needs (Outbound Access)
For the Search Service to index data and use AI skills, its System-Assigned Managed Identity must be granted the following roles on your external resources:

| Target Resource | Required Role | Purpose |
|-----------------|---------------|---------|
| **Azure Blob Storage** | `Storage Blob Data Reader` | Allows the search indexer to read files/documents from Blob containers. |
| **Azure SQL Database** | *SQL specific roles (e.g., db_datareader)* | Allows the indexer to read from SQL tables/views. *(Note: SQL requires setting the AD Admin and adding the identity as a user in the database).* |
| **Azure OpenAI** | `Cognitive Services OpenAI User` | Allows the search service to call OpenAI embedding models for vector search. |
| **Azure AI Services** | `Cognitive Services User` | Allows the search skillset to use OCR, entity recognition, and language translation. |

### B. Roles Developers / Apps Need (Inbound Access)
For your deployment scripts, backend applications, or developers to interact with the Search Service, they need the following roles assigned on the Search Service resource:

| User / Application | Required Role | Purpose |
|--------------------|---------------|---------|
| **CI/CD Pipeline / DevOps App** | `Search Service Contributor` | Allows the pipeline to create and update Indexes, Indexers, Skillsets, and Data Sources. |
| **Backend Web App (Querying)** | `Search Index Data Reader` | Allows the application to run search queries against the index. |
| **Backend Web App (Pushing Data)** | `Search Index Data Contributor` | Allows the application to push, update, or delete documents in the index directly. |

---

## 3. Implementation Instructions (PowerShell)

### Step 1: Enable System-Assigned Managed Identity on Search Service
If not already enabled during creation, enable the identity on your new Search Service:

```powershell
$resourceGroupName = "YourResourceGroup"
$searchServiceName = "YourNewSearchService"

# Enable System Assigned Identity
Set-AzSearchService -ResourceGroupName $resourceGroupName -Name $searchServiceName -IdentityType SystemAssigned

# Retrieve the Principal ID for role assignments
$searchService = Get-AzSearchService -ResourceGroupName $resourceGroupName -Name $searchServiceName
$searchPrincipalId = $searchService.Identity.PrincipalId
```

### Step 2: Grant Search Service Access to Storage (Example)
Assign the `Storage Blob Data Reader` role to the Search Service so it can read your data source.

```powershell
$storageAccountName = "YourStorageAccount"
$storageAccount = Get-AzStorageAccount -ResourceGroupName $resourceGroupName -Name $storageAccountName

New-AzRoleAssignment `
	-ObjectId $searchPrincipalId `
	-RoleDefinitionName "Storage Blob Data Reader" `
	-Scope $storageAccount.Id
```

### Step 3: Grant Search Service Access to Azure OpenAI (Example)
Assign the `Cognitive Services OpenAI User` role to the Search Service.

```powershell
$openAiAccountName = "YourOpenAIAccount"
$openAiAccount = Get-AzCognitiveServicesAccount -ResourceGroupName $resourceGroupName -Name $openAiAccountName

New-AzRoleAssignment `
	-ObjectId $searchPrincipalId `
	-RoleDefinitionName "Cognitive Services OpenAI User" `
	-Scope $openAiAccount.Id
```

### Step 4: Grant Your Application Access to Query the Search Index
Give your backend Web App (or developer account) permissions to query the service.

```powershell
$appIdOrUserObjectId = "ObjectId-Of-Your-App-Or-User"

New-AzRoleAssignment `
	-ObjectId $appIdOrUserObjectId `
	-RoleDefinitionName "Search Index Data Reader" `
	-Scope $searchService.Id
```

### Summary of Azure SQL AD Authentication Setup (If Applicable)
If your data source is Azure SQL, assigning an Azure RBAC role isn't enough; you must map the identity inside the database:

1. Connect to Azure SQL as an Active Directory Admin.
2. Run the following T-SQL to create the user and grant read access:
   ```sql
   CREATE USER [YourNewSearchService] FROM EXTERNAL PROVIDER;
   ALTER ROLE db_datareader ADD MEMBER [YourNewSearchService];
   ```
