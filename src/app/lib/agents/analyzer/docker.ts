import Docker from "dockerode";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Use the correct socket path for macOS
const docker = new Docker({
  socketPath: "/Users/klaudia/.docker/run/docker.sock",
});

export async function runContainer(scripts: {
  reproScript: string;
  dockerfile: string;
}) {
  // Verify Docker connection first
  try {
    await docker.ping();
  } catch (error) {
    console.error("Failed to connect to Docker:", error);
    throw new Error(
      "Docker is not running or not accessible. Please make sure Docker Desktop is running.",
    );
  }

  const tempDir = path.join("/tmp", `bug-repro-${uuidv4()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Write the scripts to temporary files
    await fs.writeFile(path.join(tempDir, "repro.sh"), scripts.reproScript);
    await fs.writeFile(path.join(tempDir, "Dockerfile"), scripts.dockerfile);
    await fs.chmod(path.join(tempDir, "repro.sh"), "755");

    // Build the Docker image
    console.log("Building Docker image...");
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
        if (err) {
          console.error("Error building image:", err);
          reject(err);
        } else {
          console.log("Docker image built successfully");
          resolve(null);
        }
      });
    });

    // Run the container
    console.log("Creating and starting container...");
    const container = await docker.createContainer({
      Image: "bug-repro",
      Cmd: ["./repro.sh"],
      Tty: true,
    });

    await container.start();
    console.log("Container started successfully");

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
        console.log("Container output:", output);
      });
      logStream.on("end", resolve);
    });

    // Wait for container to finish
    await container.wait();
    console.log("Container finished execution");

    // Clean up
    await container.remove();
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log("Cleanup completed");

    return {
      stdout,
      logs,
      screenshots: [], // TODO: Implement screenshot capture if needed
    };
  } catch (error) {
    console.error("Error in container execution:", error);
    // Clean up on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }
    throw error;
  }
}
