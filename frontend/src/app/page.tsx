"use client";

import PocketBase from "pocketbase";
import { AuthRecord } from "pocketbase";
import { useState, createContext, useContext } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "react-query";

const pb = new PocketBase("http://127.0.0.1:8090");
const queryClient = new QueryClient();

type UserContextType = {
  user: AuthRecord;
  userUpdated: () => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserContext.Provider");
  }
  return context;
}

interface Task {
  id: string;
  title: string;
  link: string;
  bucket: string;
  group: string;
}

export default function Page() {
  const [dummy, setDummy] = useState(0);

  return (
    <QueryClientProvider client={queryClient}>
      <UserContext.Provider
        value={{
          user: pb.authStore.record,
          userUpdated: () => setDummy(dummy + 1),
        }}
      >
        <TaskList />
      </UserContext.Provider>
    </QueryClientProvider>
  );
}

function TaskList() {
  const { data: tasks, isLoading, isError } = useQuery("tasks", fetchTaskList);

  if (isLoading) {
    return <p>Loading...</p>;
  }
  if (isError) {
    return <p>Error</p>;
  }

  return (
    <div>
      <Login />
      <ul>{tasks!.map((task) => TaskItem(task))}</ul>
    </div>
  );
}

async function fetchTaskList() {
  const data = await pb.collection("tasks").getList<Task>(1, 10, {
    filter: "group = 'Nodes & Physics'",
  });
  return data.items;
}

function TaskItem(task: Task) {
  return (
    <li
      key={task.id}
      className={`p-2  m-2 rounded-md ${
        task.bucket == "done" ? "bg-red-300" : "bg-slate-100"
      } `}
    >
      <a
        href={task.link}
        target="_blank"
        className="text-blue-800 hover:text-blue-600"
      >
        {task.title}
      </a>
      <TaskButtons task={task} />
    </li>
  );
}

function TaskButtons({ task }: { task: Task }) {
  if (task.bucket === "") {
    return (
      <div>
        <SetBucketButton task={task} text="End of Live" newBucket="eol" />
        <SetBucketButton task={task} text="Active" newBucket="active" />
        <SetBucketButton task={task} text="Inactive" newBucket="inactive" />
        <SetBucketButton task={task} text="Other" newBucket="other" />
        <SetBucketButton task={task} text="Done" newBucket="done" />
      </div>
    );
  }
  if (["eol", "active", "inactive", "other"].includes(task.bucket)) {
    return (
      <div>
        <SetBucketButton task={task} text="Needs Docs" newBucket="docs" />
        <SetBucketButton task={task} text="Done" newBucket="done" />
        <SetBucketButton task={task} text="Reset" newBucket="" />
      </div>
    );
  }

  return (
    <div>
      {" "}
      <SetBucketButton task={task} text="Reset" newBucket="" />
    </div>
  );
}

function SetBucketButton({
  task,
  text,
  newBucket,
}: {
  task: Task;
  text: string;
  newBucket: string;
}) {
  const mutation = useMutation<
    unknown,
    unknown,
    unknown,
    { previous_tasks: Task[] }
  >(
    async () => {
      await pb.collection("tasks").update(task.id, { bucket: newBucket });
    },
    {
      onMutate: async () => {
        await queryClient.cancelQueries("tasks");

        const previous_tasks = queryClient.getQueryData<Task[]>("tasks") || [];
        const updated_tasks = previous_tasks.map((task_) =>
          task_.id == task.id ? { ...task_, bucket: newBucket } : task_
        );
        queryClient.setQueryData<Task[]>("tasks", updated_tasks);

        return { previous_tasks };
      },
      onError: (err, variables, context) => {
        if (context) {
          if (context.previous_tasks) {
            queryClient.setQueryData<Task[]>("tasks", context.previous_tasks);
          }
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries("tasks");
      },
    }
  );

  function onClick() {
    mutation.mutate({});
  }

  return <TaskButton text={text} onClick={onClick} />;
}

function TaskButton({ text, onClick }: { text: string; onClick?: () => void }) {
  const user = useUser();

  return (
    <button
      className={`px-2 py-0.5 mx-1 bg-blue-500 text-white rounded-md hover:bg-blue-700 ${
        user.user ? "cursor-pointer" : "cursor-not-allowed"
      }`}
      onClick={onClick}
      disabled={!user.user}
    >
      {text}
    </button>
  );
}

function Login() {
  const user = useUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onLogin() {
    await pb.collection("users").authWithPassword(email, password);
    user.userUpdated();
  }

  function onLogout() {
    pb.authStore.clear();
    user.userUpdated();
  }

  if (user.user) {
    return <button onClick={onLogout}>Logout {user.user.name}</button>;
  }

  return (
    <div>
      <input
        placeholder="email"
        onChange={(e) => setEmail(e.target.value)}
      ></input>
      <input
        placeholder="password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      ></input>
      <button
        className="bg-slate-200 p-2 rounded-xl cursor-pointer"
        onClick={onLogin}
      >
        Login
      </button>
    </div>
  );
}
