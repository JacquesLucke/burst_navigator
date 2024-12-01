from pathlib import Path
import json
import requests
from pprint import pprint

issues_path = Path("/home/jacques/Documents/all_issues_backup.json")

with open(issues_path, "r") as f:
    issues_txt = f.read()

print("file loaded")

issues = json.loads(issues_txt)

inserted = 0
for i, issue in enumerate(issues):
    labels = list(map(lambda x: x["id"], issue["labels"]))
    if 275 not in labels:
        continue
    if issue["state"] == "closed":
        continue
    task_data = {
        "title": issue["title"],
        "group": "Nodes & Physics",
        "link": issue["html_url"],
    }
    print(f"inserted: {inserted}")

    response = requests.post(
        "http://127.0.0.1:8090/api/collections/tasks/records", json=task_data
    )
    print(response)
    inserted += 1
