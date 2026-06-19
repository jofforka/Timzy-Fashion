function submitTraining(event){
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const level = document.getElementById("level").value;
  const interest = document.getElementById("interest").value;
  const message = document.getElementById("message").value.trim();

  const text = `Hello Timzy Fashion Academy,

I want to register interest for training.

Name: ${name}
Phone: ${phone}
Level: ${level}
Interest: ${interest}
Message: ${message || "Not provided"}

Please send me training details.`;

  window.open("https://wa.me/2348118103510?text=" + encodeURIComponent(text), "_blank");
}
