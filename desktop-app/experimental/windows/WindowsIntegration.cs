using System;
using System.IO;
using System.Linq;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Drawing;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using Microsoft.Win32;

[assembly: AssemblyTitle("Markdown Viewer Windows integration")]
[assembly: AssemblyDescription("Markdown Viewer Windows integration")]
[assembly: AssemblyProduct("Markdown Viewer")]
[assembly: AssemblyCompany("Markdown Viewer contributors")]
[assembly: AssemblyVersion("3.10.5.0")]

// Explicit per-user registration. Never writes UserChoice, extension defaults,
// or machine-wide keys. A link to this portable executable is not an installation.
internal sealed class Registration {
    const string Id = "MarkdownViewer.NativeDemo", ProgId = "MarkdownViewer.NativeDemo.Markdown";
    internal const string RegisteredName = "Markdown Viewer";
    readonly string software;
    internal Registration(string root = "Software") { software = root; }
    string Key(string path) { return software + "\\" + path; }
    internal string Get(string path, string name = "") {
        using (var key = Registry.CurrentUser.OpenSubKey(Key(path)))
            return key == null ? null : key.GetValue(name) as string;
    }
    internal void Put(string path, string name, string value) {
        using (var key = Registry.CurrentUser.CreateSubKey(Key(path))) key.SetValue(name, value, RegistryValueKind.String);
    }
    bool Exists(string path) { using(var key = Registry.CurrentUser.OpenSubKey(Key(path))) return key != null; }
    string[] OwnedKeys(string executable) {
        return new [] { "Classes\\Applications\\" + Path.GetFileName(executable), "Classes\\" + ProgId, Id,
            "Microsoft\\Windows\\CurrentVersion\\App Paths\\" + Path.GetFileName(executable) };
    }
    internal void Register(string executable) {
        var registeredPath = Key(Id + "\\Capabilities");
        var registered = Get("RegisteredApplications", RegisteredName);
        if(registered != null && registered != registeredPath) throw new InvalidOperationException("Registration belongs to another application.");
        foreach (var key in OwnedKeys(executable))
            if (Exists(key) && Get(key, "MarkdownViewerOwner") != Id) throw new InvalidOperationException("Registration belongs to another application.");
        var previous = Get(Id, "ExecutablePath");
        if(previous != null && !String.Equals(previous, executable, StringComparison.OrdinalIgnoreCase)) Unregister(previous);
        foreach(var key in OwnedKeys(executable)) {
            Put(key, "MarkdownViewerOwner", Id);
            Put(key, "ExecutablePath", executable);
        }
        var app = OwnedKeys(executable)[0];
        var prog = "Classes\\" + ProgId;
        var capabilities = Id + "\\Capabilities";
        var command = "\"" + executable + "\" \"%1\"";
        var icon = "\"" + executable + "\",0";
        var documentIcon = "\"" + executable + "\",-200";
        Put(app, "FriendlyAppName", "Markdown Viewer");
        Put(app + "\\DefaultIcon", "", documentIcon);
        Put(app + "\\shell\\open\\command", "", command);
        Put(prog, "", "Markdown document");
        Put(prog + "\\Application", "ApplicationName", "Markdown Viewer");
        Put(prog + "\\Application", "ApplicationIcon", icon);
        Put(prog + "\\Application", "ApplicationDescription", "Markdown Viewer");
        Put(prog + "\\Application", "ApplicationCompany", "Markdown Viewer contributors");
        Put(prog + "\\DefaultIcon", "", documentIcon);
        Put(prog + "\\shell\\open\\command", "", command);
        // Windows requires the capability name and RegisteredApplications value
        // name to match. Keep ownership/storage separate from this display name.
        Put(capabilities, "ApplicationName", RegisteredName);
        Put(capabilities, "ApplicationDescription", "Markdown Viewer");
        Put(capabilities, "ApplicationIcon", icon);
        Put(OwnedKeys(executable)[3], "", executable);
        foreach(var extension in new [] { ".md", ".markdown" }) {
            Put(app + "\\SupportedTypes", extension, "");
            Put("Classes\\" + extension + "\\OpenWithProgids", ProgId, "");
            Put(capabilities + "\\FileAssociations", extension, ProgId);
        }
        Put("RegisteredApplications", RegisteredName, registeredPath);
        // Migrate only the earlier trial's own internal-name registration.
        if(Get("RegisteredApplications", Id) == registeredPath)
            using(var key = Registry.CurrentUser.OpenSubKey(Key("RegisteredApplications"), true)) key.DeleteValue(Id, false);
    }
    internal void Unregister(string executable) {
        // An old portable copy cannot remove a newer copy's registration.
        if(!String.Equals(Get(Id, "ExecutablePath"), executable, StringComparison.OrdinalIgnoreCase)) return;
        foreach(var key in OwnedKeys(executable)) {
            // Earlier portable helpers did not register App Paths.
            if(!Exists(key)) continue;
            if(Get(key, "MarkdownViewerOwner") != Id || !String.Equals(Get(key, "ExecutablePath"), executable, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Registration ownership changed.");
        }
        foreach(var extension in new [] { ".md", ".markdown" }) {
            using(var key = Registry.CurrentUser.OpenSubKey(Key("Classes\\" + extension + "\\OpenWithProgids"), true))
                if(key != null) key.DeleteValue(ProgId, false);
        }
        foreach(var name in new [] { RegisteredName, Id })
            if(Get("RegisteredApplications", name) == Key(Id + "\\Capabilities"))
                using(var key = Registry.CurrentUser.OpenSubKey(Key("RegisteredApplications"), true)) key.DeleteValue(name, false);
        // Exact per-user keys, verified above. Extension/default keys are retained.
        foreach(var key in OwnedKeys(executable)) Registry.CurrentUser.DeleteSubKeyTree(Key(key), false);
    }
    internal static void SelfTest() {
        var root = "Software\\MarkdownViewer.NativeDemo.Tests\\" + Guid.NewGuid().ToString();
        var test = new Registration(root);
        var first = "C:\\Trial folder\\δοκιμή & percent%#\\First.exe";
        var second = "C:\\Trial folder\\Second.exe";
        Action<bool> check = ok => { if(!ok) throw new Exception("Registry assertion failed."); };
        try {
            test.Put("Classes\\.md", "", "Other.Application");
            test.Put("Classes\\.md\\OpenWithProgids", "Other.Application", "");
            test.Register(first);
            test.Put("RegisteredApplications", Id, test.Key(Id + "\\Capabilities"));
            test.Register(first);
            check(test.Get(Id + "\\Capabilities", "ApplicationName") == RegisteredName);
            check(test.Get("RegisteredApplications", RegisteredName) == test.Key(Id + "\\Capabilities"));
            check(test.Get("RegisteredApplications", Id) == null);
            check(test.Get(Id + "\\Capabilities", "ApplicationDescription") == "Markdown Viewer");
            check(test.Get("Classes\\.md") == "Other.Application");
            check(test.Get("Classes\\" + ProgId + "\\DefaultIcon") == "\"" + first + "\",-200");
            check(test.Get(test.OwnedKeys(first)[0] + "\\DefaultIcon") == "\"" + first + "\",-200");
            check(test.Get("Classes\\" + ProgId + "\\Application", "ApplicationIcon") == "\"" + first + "\",0");
            check(test.Get("Classes\\" + ProgId + "\\shell\\open\\command") == "\"" + first + "\" \"%1\"");
            check(test.Get("Classes\\.markdown\\OpenWithProgids", ProgId) == "");
            check(test.Get(test.OwnedKeys(first)[3]) == first);
            // Migration must tolerate the older helper's missing App Paths key.
            Registry.CurrentUser.DeleteSubKeyTree(test.Key(test.OwnedKeys(first)[3]), false);
            test.Register(second);
            test.Unregister(first);
            check(test.Get(Id, "ExecutablePath") == second);
            check(!test.Exists("Classes\\Applications\\First.exe"));
            test.Unregister(second);
            check(!test.Exists("Classes\\" + ProgId));
            check(!test.Exists(test.OwnedKeys(second)[3]));
            check(test.Get("Classes\\.md") == "Other.Application");
            check(test.Get("Classes\\.md\\OpenWithProgids", "Other.Application") == "");
            check(test.Get("Classes\\.md\\OpenWithProgids", ProgId) == null);
            test.Put("RegisteredApplications", RegisteredName, "Software\\AnotherApplication\\Capabilities");
            bool nameRejected = false;
            try { test.Register(first); } catch(InvalidOperationException) { nameRejected = true; }
            check(nameRejected && !test.Exists(Id));
            check(test.Get("RegisteredApplications", RegisteredName) == "Software\\AnotherApplication\\Capabilities");
            using(var key = Registry.CurrentUser.OpenSubKey(test.Key("RegisteredApplications"), true)) key.DeleteValue(RegisteredName);
            test.Put("Classes\\" + ProgId, "", "Other owner");
            bool rejected = false;
            try { test.Register(first); } catch(InvalidOperationException) { rejected = true; }
            check(rejected);
        } finally { Registry.CurrentUser.DeleteSubKeyTree(root, false); }
    }
}

internal static class Program {
    static Dictionary<string, object> catalog = new Dictionary<string, object>();
    static string T(string key) { object value; return catalog.TryGetValue(key, out value) ? value.ToString() : key; }
    [DllImport("shell32.dll")] static extern void SHChangeNotify(uint e, uint f, IntPtr a, IntPtr b);
    static void Notify() { SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero); }
    static string FindExecutable(string[] args) {
        var input = args.FirstOrDefault(x => !x.StartsWith("--", StringComparison.Ordinal));
        if(input == null) {
            var files = Directory.GetFiles(AppDomain.CurrentDomain.BaseDirectory, "Markdown-Viewer-PR269-*-win_x64.exe");
            if(files.Length != 1) throw new InvalidOperationException("Keep one trial executable next to this helper, or pass its full path.");
            input = files[0];
        }
        input = Path.GetFullPath(input);
        var metadata = FileVersionInfo.GetVersionInfo(input);
        if(metadata.ProductName != "Markdown Viewer" || metadata.FileDescription != "Markdown Viewer") throw new InvalidOperationException("Select a branded Markdown Viewer executable.");
        return input;
    }
    [STAThread] static int Main(string[] args) {
        try {
            if(args.Contains("--self-test")) { Registration.SelfTest(); return 0; }
            var locale = System.Globalization.CultureInfo.CurrentUICulture.Name.ToLowerInvariant();
            locale = locale.StartsWith("zh-tw") || locale.StartsWith("zh-hk") ? "tw" : locale.Split('-')[0];
            using(var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("locale." + locale + ".json"))
                if(stream != null) using(var reader = new StreamReader(stream)) catalog = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
            var executable = FindExecutable(args);
            var registration = new Registration();
            if(args.Contains("--register")) { registration.Register(executable); Notify(); return 0; }
            if(args.Contains("--unregister")) { registration.Unregister(executable); Notify(); return 0; }
            Application.EnableVisualStyles();
            var form = new Form { Text = T("Windows integration"), ClientSize = new Size(570, 255), StartPosition = FormStartPosition.CenterScreen,
                FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, MinimizeBox = false, Font = new Font("Segoe UI", 10), Icon = Icon.ExtractAssociatedIcon(executable) };
            var explanation = new Label { Text = T("Add Markdown Viewer to Open with. Your default app stays unchanged."), AutoSize = false, Location = new Point(20,20), Size = new Size(530,60) };
            var status = new Label { AutoSize = false, Location = new Point(20,165), Size = new Size(530,65) };
            var register = new Button { Text = T("Register app"), Location = new Point(20,95), Size = new Size(165,45) };
            var remove = new Button { Text = T("Remove registration"), Location = new Point(195,95), Size = new Size(165,45) };
            var defaults = new Button { Text = T("Default apps"), Location = new Point(370,95), Size = new Size(180,45) };
            Action<Action> run = operation => { try { operation(); status.Text = T("Done. Your default app was not changed."); } catch(Exception ex) { MessageBox.Show(form, T(ex.Message), T("Windows integration"), MessageBoxButtons.OK, MessageBoxIcon.Error); } };
            register.Click += (s,e) => run(() => { registration.Register(executable); Notify(); });
            remove.Click += (s,e) => run(() => { registration.Unregister(executable); Notify(); });
            defaults.Click += (s,e) => run(() => Process.Start(new ProcessStartInfo("ms-settings:defaultapps?registeredAppUser=" + Uri.EscapeDataString(Registration.RegisteredName)) { UseShellExecute = true }));
            form.Controls.AddRange(new Control[] {explanation,register,remove,defaults,status});
            Application.Run(form);
            return 0;
        } catch(Exception ex) {
            if(!args.Contains("--self-test")) MessageBox.Show(T(ex.Message), "Markdown Viewer", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Console.Error.WriteLine(ex);
            return 1;
        }
    }
}
