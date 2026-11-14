// Neutralino's vault/file APIs use the same Apple libc++ filesystem dependency.
#include <filesystem>

int main() {
    return std::filesystem::exists(std::filesystem::current_path()) ? 0 : 1;
}
