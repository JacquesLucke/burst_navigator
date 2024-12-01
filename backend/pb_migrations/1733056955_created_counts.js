/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "_clone_wXDb",
        "max": 0,
        "min": 0,
        "name": "group",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "_clone_NezB",
        "max": 0,
        "min": 0,
        "name": "bucket",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number3257917790",
        "max": null,
        "min": null,
        "name": "total",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      }
    ],
    "id": "pbc_1345084852",
    "indexes": [],
    "listRule": null,
    "name": "counts",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "SELECT \n  \"group\", \"bucket\", COUNT(\"id\") as \"total\",  (ROW_NUMBER() OVER()) as id\nFROM tasks \n  GROUP BY \"group\", \"bucket\"",
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1345084852");

  return app.delete(collection);
})
