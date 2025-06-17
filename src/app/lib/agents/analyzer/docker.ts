import Docker from "dockerode";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const docker = new Docker({
  socketPath: "/Users/klaudia/.docker/run/docker.sock",
});

export async function runContainer(scripts: {
  reproScript: string;
  dockerfile: string;
}) {
  const tempDir = path.join("/tmp", `bug-repro-${uuidv4()}`);
  await fs.mkdir(tempDir, { recursive: true });

  // Write the scripts to temporary files
  await fs.writeFile(path.join(tempDir, "repro.sh"), scripts.reproScript);
  await fs.writeFile(path.join(tempDir, "Dockerfile"), scripts.dockerfile);
  await fs.chmod(path.join(tempDir, "repro.sh"), "755");

  try {
    // Build the Docker image
    const buildStream = await docker.buildImage(
      {
        context: tempDir,
        src: ["Dockerfile", "repro.sh"],
      },
      { t: "bug-repro" },
    );

    await new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docker.modem.followProgress(buildStream, (err: any) => {
        if (err) reject(err);
        else resolve(null);
      });
    });

    // Run the container
    const container = await docker.createContainer({
      Image: "bug-repro",
      Cmd: ["./repro.sh"],
      Tty: true,
    });

    await container.start();

    // Get container logs
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });

    let stdout = "";
    let logs = "";

    await new Promise((resolve) => {
      logStream.on("data", (chunk: Buffer) => {
        const output = chunk.toString();
        stdout += output;
        logs += output;
      });
      logStream.on("end", resolve);
    });

    // Wait for container to finish
    await container.wait();

    // Clean up
    await container.remove();
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      stdout,
      logs,
      screenshots: [], // TODO: Implement screenshot capture if needed
    };
  } catch (error) {
    console.error("Error running container:", error);
    throw error;
  }
}
