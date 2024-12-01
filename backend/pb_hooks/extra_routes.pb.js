/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  "POST",
  "/get_new_tasks",
  (c) => {
    try {
      let body = new DynamicModel({
        group: "",
        bucket_id: "",
      });
      c.bindBody(body);
      $app
        .db()
        .newQuery("UPDATE tasks SET assigned = '' WHERE assigned = {:user_id}")
        .bind({
          user_id: c.auth.id,
        })
        .execute();

      $app
        .db()
        .newQuery(
          `
            UPDATE tasks
            SET assigned = {:user_id}
            WHERE id IN (
                SELECT id
                FROM tasks
                WHERE assigned = '' AND \`group\` = {:group} AND bucket = {:bucket_id}
                ORDER BY RANDOM()
                LIMIT 20
            )
           `
        )
        .bind({
          user_id: c.auth.id,
          group: body.group,
          bucket_id: body.bucket_id,
        })
        .execute();
    } catch (e) {
      console.log(e);
    }
  },
  $apis.requireAuth()
);
