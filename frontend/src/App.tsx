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

type BucketDefinition = {
  name: string;
  bucket_id: string;
};

const currentGroup = "Nodes & Physics";

const bucketDefinitions: BucketDefinition[] = [
  { name: "Uncategorized", bucket_id: "" },
  { name: "End of Live", bucket_id: "eol" },
  { name: "Active", bucket_id: "active" },
  { name: "Inactive", bucket_id: "inactive" },
  { name: "Other", bucket_id: "other" },
  { name: "Docs", bucket_id: "docs" },
  { name: "Done", bucket_id: "done" },
];

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
        <Login />
        <TaskList />
      </UserContext.Provider>
    </QueryClientProvider>
  );
}

function TaskList() {
  const user = useUser();

  const {
    data: tasks,
    isLoading: tasksLoading,
    isError: tasksError,
  } = useQuery("tasks", fetchTaskList);
  const {
    data: counts,
    isLoading: countsLoading,
    isError: countsError,
  } = useQuery("counts", fetchCounts);

  const mutateBucket = useMutation<
    unknown,
    unknown,
    { task: Task; newBucket: string },
    { previous_tasks: Task[]; previous_counts: CountItem[] }
  >(
    async ({ task, newBucket }) => {
      await pb.collection("tasks").update(task.id, { bucket: newBucket });
    },
    {
      onMutate: async ({ task, newBucket }) => {
        await queryClient.cancelQueries("tasks");

        const previous_tasks = queryClient.getQueryData<Task[]>("tasks") || [];
        const updated_tasks = previous_tasks.map((task_) =>
          task_.id === task.id ? { ...task_, bucket: newBucket } : task_
        );
        queryClient.setQueryData<Task[]>("tasks", updated_tasks);

        const previous_counts =
          queryClient.getQueryData<CountItem[]>("counts") || [];
        let updated_counts = previous_counts;
        // Reduce old count.
        updated_counts = previous_counts.map((count_) =>
          count_.bucket === task.bucket
            ? { ...count_, total: count_.total - 1 }
            : count_
        );
        // Increase new count.
        updated_counts = previous_counts.map((count_) =>
          count_.bucket === newBucket
            ? { ...count_, total: count_.total + 1 }
            : count_
        );
        queryClient.setQueryData<CountItem[]>("counts", updated_counts);

        return { previous_tasks, previous_counts };
      },
      onError: (err, variables, context) => {
        if (context) {
          if (context.previous_tasks) {
            queryClient.setQueryData<Task[]>("tasks", context.previous_tasks);
          }
          if (context.previous_counts) {
            queryClient.setQueryData<CountItem[]>(
              "counts",
              context.previous_counts
            );
          }
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries("tasks");
        queryClient.invalidateQueries("counts");
      },
    }
  );

  if (tasksLoading || countsLoading) {
    return <p>Loading...</p>;
  }
  if (tasksError || countsError) {
    return <p>Error</p>;
  }

  return (
    <table className="font-mono w-full">
      <thead>
        <TitleRow />
      </thead>
      <tbody>
        {CountsRow(counts!)}
        {tasks!.map((task, index) =>
          TaskRow(task, index, mutateBucket, user.user)
        )}
        <GetTasksRow />
      </tbody>
    </table>
  );
}

function TitleRow() {
  return (
    <tr>
      <th>Title</th>
      {bucketDefinitions.map((bucketDefinition) => (
        <th key={bucketDefinition.bucket_id} className="px-2">
          {bucketDefinition.name}
        </th>
      ))}
    </tr>
  );
}

function CountsRow(counts: CountItem[]) {
  return (
    <tr>
      <td></td>
      {bucketDefinitions.map((bucketDefinition) => (
        <td key={bucketDefinition.bucket_id} className="px-2 text-center">
          {counts.find((count) => count.bucket === bucketDefinition.bucket_id)
            ?.total || 0}
        </td>
      ))}
    </tr>
  );
}

function TaskRow(
  task: Task,
  index: number,
  mutateBucket: any,
  user: AuthRecord
) {
  return (
    <tr key={task.id} className={`${index % 2 === 0 ? "bg-slate-800" : ""}`}>
      <td>
        {" "}
        <a
          href={task.link}
          rel="noreferrer"
          target="_blank"
          className="hover:text-blue-200"
        >
          {task.title}
        </a>
      </td>
      {bucketDefinitions.map((bucketDefinition) => (
        <td key={bucketDefinition.bucket_id} className="text-center">
          {task.bucket === bucketDefinition.bucket_id ? (
            <span className="text-green-500">✓</span>
          ) : (
            MoveTaskButton(task, bucketDefinition.bucket_id, mutateBucket, user)
          )}
        </td>
      ))}
    </tr>
  );
}

function MoveTaskButton(
  task: Task,
  newBucket: string,
  mutateBucket: any,
  user: AuthRecord
) {
  function onClick() {
    mutateBucket.mutate({ task, newBucket });
  }
  const isLoggedIn = user || false;

  return (
    <button
      className={`text-slate-500 rounded-full px-2 hover:text-slate-800 hover:bg-slate-600 hover:duration-200 duration-500 ${
        isLoggedIn ? "cursor-pointer " : "cursor-not-allowed"
      }`}
      onClick={onClick}
      disabled={!isLoggedIn}
    >
      ✗
    </button>
  );
}

async function fetchTaskList() {
  const data = await pb.collection("tasks").getList<Task>(1, 30, {
    filter: `group = '${currentGroup}'`,
  });
  return data.items;
}

interface CountItem {
  group: string;
  bucket: string;
  total: number;
}

async function fetchCounts() {
  const data = await pb.collection("counts").getFullList<CountItem>({
    filter: `group = '${currentGroup}'`,
  });
  return data;
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
    return (
      <button
        onClick={onLogout}
        className="hover:border-slate-200 border-2 border-transparent duration-200 rounded-xl px-2 cursor-pointer"
      >
        Logout {user.user.name}
      </button>
    );
  }

  return (
    <div>
      <input
        placeholder="email"
        onChange={(e) => setEmail(e.target.value)}
        className="m-2"
      ></input>
      <input
        placeholder="password"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
        className="m-2 bg-black"
      ></input>
      <button
        className="hover:border-slate-200 border-2 border-transparent duration-200 rounded-xl px-2 cursor-pointer"
        onClick={onLogin}
      >
        Login
      </button>
    </div>
  );
}

function GetTasksRow() {
  const user = useUser();
  const isLoggedIn = !!user.user || false;

  async function onClick(bucket_id: string) {
    queryClient.invalidateQueries("tasks");
  }

  return (
    <tr>
      <td></td>
      {bucketDefinitions.map((bucketDefinition) => (
        <td key={bucketDefinition.bucket_id} className="text-center">
          <button
            className={`hover:border-slate-200 border-2 border-transparent duration-200 rounded-xl px-2 mt-8 ${
              isLoggedIn ? "cursor-pointer " : "cursor-not-allowed"
            }`}
            onClick={() => onClick(bucketDefinition.bucket_id)}
          >
            Load
          </button>
        </td>
      ))}
    </tr>
  );
}
