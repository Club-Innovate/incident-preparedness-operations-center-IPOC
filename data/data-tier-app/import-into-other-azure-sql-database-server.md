---
# Import into the other Azure SQL Database server

The recipient can use SSMS:

1. Connect to their target Azure SQL logical server.
2. Right-click the server’s **Databases** node—not an existing database.
3. Select **Import Data-tier Application...**
4. Select the `.bacpac` file.
5. Enter a **new database name**.
6. Configure the target service tier and size if prompted.
7. Complete the wizard.

The import generally creates a new database. It is not the equivalent of overwriting an existing database with `RESTORE DATABASE`. Azure SQL Database supports importing BACPAC files from local storage or Azure Blob Storage.
---