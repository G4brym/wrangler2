import assert from "node:assert";

// TODO: move to `@cloudflare/unenv-preset`
// See: https://github.com/cloudflare/workers-sdk/issues/7579
export async function testUnenvPreset() {
	try {
		await testCryptoGetRandomValues();
		await testWorkerdImplementsBuffer();
		await testWorkerdModules();
		await testUtilImplements();
		await testWorkerdPath();
		await testWorkerdDns();
	} catch (e) {
		return new Response(String(e));
	}

	return new Response("OK!");
}

async function testCryptoGetRandomValues() {
	const crypto = await import("node:crypto");

	const array = new Uint32Array(10);
	crypto.getRandomValues(array);
	assert.strictEqual(array.length, 10);
	assert(array.every((v) => v >= 0 && v <= 0xff_ff_ff_ff));
}

async function testWorkerdImplementsBuffer() {
	const encoder = new TextEncoder();
	const buffer = await import("node:buffer");
	const Buffer = buffer.Buffer;
	assert.strictEqual(buffer.isAscii(encoder.encode("hello world")), true);
	assert.strictEqual(buffer.isUtf8(encoder.encode("Yağız")), true);
	assert.strictEqual(buffer.btoa("hello"), "aGVsbG8=");
	assert.strictEqual(buffer.atob("aGVsbG8="), "hello");
	{
		const dest = buffer.transcode(
			Buffer.from([
				0x74, 0x00, 0x1b, 0x01, 0x73, 0x00, 0x74, 0x00, 0x20, 0x00, 0x15, 0x26,
			]),
			"ucs2",
			"utf8"
		);
		assert.strictEqual(
			dest.toString(),
			Buffer.from("těst ☕", "utf8").toString()
		);
	}
	assert.ok(new buffer.File([], "file"));
	assert.ok(new buffer.Blob([]));
	assert.strictEqual(typeof buffer.INSPECT_MAX_BYTES, "number");
	assert.strictEqual(typeof buffer.resolveObjectURL, "function");
}

async function testWorkerdModules() {
	const module = await import("node:module");
	// @ts-expect-error exposed by workerd
	const require = module.createRequire("/");
	const modules = [
		"assert",
		"assert/strict",
		"buffer",
		"diagnostics_channel",
		"dns",
		"dns/promises",
		"events",
		"path",
		"path/posix",
		"path/win32",
		"querystring",
		"stream",
		"stream/consumers",
		"stream/promises",
		"stream/web",
		"string_decoder",
		"url",
		"util/types",
		"zlib",
	];
	for (const m of modules) {
		assert.strictEqual(await import(m), require(m));
	}
}

async function testUtilImplements() {
	const { types } = await import("node:util");
	assert.strictEqual(types.isExternal("hello world"), false);
	assert.strictEqual(types.isAnyArrayBuffer(new ArrayBuffer(0)), true);
}

async function testWorkerdPath() {
	const pathWin32 = await import("node:path/win32");
	assert.strictEqual(pathWin32.sep, "\\");
	assert.strictEqual(pathWin32.delimiter, ";");
	const pathPosix = await import("node:path/posix");
	assert.strictEqual(pathPosix.sep, "/");
	assert.strictEqual(pathPosix.delimiter, ":");
}

async function testWorkerdDns() {
	const dns = await import("node:dns");
	await new Promise((resolve, reject) => {
		dns.resolveTxt("nodejs.org", (error, results) => {
			if (error) {
				reject(error);
				return;
			}
			assert.ok(Array.isArray(results[0]));
			assert.strictEqual(results.length, 1);
			assert.ok(results[0][0].startsWith("v=spf1"));
			resolve(null);
		});
	});

	const dnsPromises = await import("node:dns/promises");
	const results = await dnsPromises.resolveCaa("google.com");
	assert.ok(Array.isArray(results));
	assert.strictEqual(results.length, 1);
	assert.strictEqual(typeof results[0].critical, "number");
	assert.strictEqual(results[0].critical, 0);
	assert.strictEqual(results[0].issue, "pki.goog");
}