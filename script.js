const button = document.getElementById("hello-button");
const message = document.getElementById("message");

button.addEventListener("click", () => {
  message.textContent = "Hello from JustinWebsite!";
});
